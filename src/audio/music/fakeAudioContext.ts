/**
 * A tiny, strict stand-in for AudioContext used by unit tests (and any headless tool) to exercise
 * the sequencer and SFX recipes in node. It is never imported by the game.
 *
 * It throws where real browsers throw — non-finite numbers, negative times, exponential ramps to 0,
 * starting a source twice, stopping one that never started, connecting across contexts — so a test
 * that runs recipes against it catches the mistakes that would silently kill a sound on an iPhone.
 * Every node and scheduled source is recorded for assertions; `currentTime` is set by the test.
 */

function finite(v: number, what: string): void {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(`${what}: non-finite value ${v}`);
}

function time(t: number, what: string): void {
  finite(t, what);
  if (t < 0) throw new RangeError(`${what}: negative time ${t}`);
}

export interface ParamEvent {
  type: 'set' | 'linear' | 'exp' | 'target' | 'cancel';
  value: number;
  time: number;
  timeConstant?: number;
}

export class FakeAudioParam {
  readonly name: string;
  readonly owner: FakeAudioNode;
  readonly defaultValue: number;
  readonly events: ParamEvent[] = [];
  private v: number;

  constructor(owner: FakeAudioNode, name: string, value: number) {
    this.owner = owner;
    this.name = name;
    this.defaultValue = value;
    this.v = value;
  }

  get value(): number {
    return this.v;
  }

  set value(x: number) {
    finite(x, `${this.name}.value`);
    this.v = x;
  }

  setValueAtTime(value: number, t: number): this {
    finite(value, `${this.name}.setValueAtTime value`);
    time(t, `${this.name}.setValueAtTime`);
    this.events.push({ type: 'set', value, time: t });
    return this;
  }

  linearRampToValueAtTime(value: number, t: number): this {
    finite(value, `${this.name}.linearRamp value`);
    time(t, `${this.name}.linearRamp`);
    this.events.push({ type: 'linear', value, time: t });
    return this;
  }

  exponentialRampToValueAtTime(value: number, t: number): this {
    finite(value, `${this.name}.exponentialRamp value`);
    time(t, `${this.name}.exponentialRamp`);
    if (value === 0) throw new RangeError(`${this.name}.exponentialRamp to 0`);
    this.events.push({ type: 'exp', value, time: t });
    return this;
  }

  setTargetAtTime(value: number, t: number, timeConstant: number): this {
    finite(value, `${this.name}.setTarget value`);
    time(t, `${this.name}.setTarget`);
    finite(timeConstant, `${this.name}.setTarget timeConstant`);
    if (timeConstant < 0) throw new RangeError(`${this.name}.setTarget negative timeConstant`);
    this.events.push({ type: 'target', value, time: t, timeConstant });
    return this;
  }

  cancelScheduledValues(t: number): this {
    time(t, `${this.name}.cancelScheduledValues`);
    for (let i = this.events.length - 1; i >= 0; i--) if (this.events[i]!.time >= t) this.events.splice(i, 1);
    this.events.push({ type: 'cancel', value: this.v, time: t });
    return this;
  }

  cancelAndHoldAtTime(t: number): this {
    return this.cancelScheduledValues(t);
  }
}

export class FakeAudioNode {
  readonly context: FakeAudioContext;
  readonly kind: string;
  readonly outputs = new Set<FakeAudioNode | FakeAudioParam>();
  connectedIn = 0;

  constructor(ctx: FakeAudioContext, kind: string) {
    this.context = ctx;
    this.kind = kind;
    ctx.created.push(this);
    ctx.counts[kind] = (ctx.counts[kind] ?? 0) + 1;
  }

  connect<T extends FakeAudioNode | FakeAudioParam>(dest: T): T {
    const owner = dest instanceof FakeAudioParam ? dest.owner : dest;
    if (!(owner instanceof FakeAudioNode)) throw new TypeError('connect: not an AudioNode/AudioParam');
    if (owner.context !== this.context) throw new Error('connect: node from another context');
    this.outputs.add(dest);
    if (dest instanceof FakeAudioNode) dest.connectedIn++;
    return dest;
  }

  disconnect(dest?: FakeAudioNode | FakeAudioParam): void {
    if (dest) this.outputs.delete(dest);
    else this.outputs.clear();
  }
}

export class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam(this, 'gain', 1);
  constructor(ctx: FakeAudioContext) {
    super(ctx, 'gain');
  }
}

export class FakeScheduledSource extends FakeAudioNode {
  startTime = -1;
  stopTime = Infinity;
  onended: (() => void) | null = null;

  start(when = 0, offset?: number): void {
    time(when, `${this.kind}.start`);
    if (offset !== undefined) {
      time(offset, `${this.kind}.start offset`);
    }
    if (this.startTime >= 0) throw new Error(`InvalidStateError: ${this.kind} started twice`);
    this.startTime = when;
    if (when < this.context.currentTime - 1e-9) this.context.lateStarts++;
    this.context.sources.push(this);
  }

  stop(when = 0): void {
    time(when, `${this.kind}.stop`);
    if (this.startTime < 0) throw new Error(`InvalidStateError: ${this.kind} stopped before start`);
    this.stopTime = when;
  }
}

const OSC_TYPES = new Set(['sine', 'square', 'sawtooth', 'triangle']);

export class FakeOscillatorNode extends FakeScheduledSource {
  readonly frequency = new FakeAudioParam(this, 'frequency', 440);
  readonly detune = new FakeAudioParam(this, 'detune', 0);
  private t: OscillatorType = 'sine';
  constructor(ctx: FakeAudioContext) {
    super(ctx, 'oscillator');
  }
  get type(): OscillatorType {
    return this.t;
  }
  set type(v: OscillatorType) {
    if (!OSC_TYPES.has(v)) throw new Error(`InvalidStateError: oscillator type "${v}"`);
    this.t = v;
  }
}

export class FakeAudioBuffer {
  readonly numberOfChannels: number;
  readonly length: number;
  readonly sampleRate: number;
  private readonly data: Float32Array[];
  constructor(channels: number, length: number, sampleRate: number) {
    if (!(channels >= 1 && channels <= 32)) throw new Error('NotSupportedError: channels');
    if (!(length >= 1)) throw new Error('NotSupportedError: length');
    if (!(sampleRate >= 3000 && sampleRate <= 768000)) throw new Error('NotSupportedError: sampleRate');
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.data = Array.from({ length: channels }, () => new Float32Array(length));
  }
  get duration(): number {
    return this.length / this.sampleRate;
  }
  getChannelData(i: number): Float32Array {
    const d = this.data[i];
    if (!d) throw new Error('IndexSizeError: channel');
    return d;
  }
}

export class FakeBufferSourceNode extends FakeScheduledSource {
  buffer: FakeAudioBuffer | null = null;
  loop = false;
  readonly playbackRate = new FakeAudioParam(this, 'playbackRate', 1);
  readonly detune = new FakeAudioParam(this, 'detune', 0);
  constructor(ctx: FakeAudioContext) {
    super(ctx, 'bufferSource');
  }
  override start(when = 0, offset?: number): void {
    if (!this.buffer) throw new Error('bufferSource started without a buffer');
    super.start(when, offset);
  }
}

const FILTER_TYPES = new Set(['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass']);

export class FakeBiquadFilterNode extends FakeAudioNode {
  readonly frequency = new FakeAudioParam(this, 'frequency', 350);
  readonly Q = new FakeAudioParam(this, 'Q', 1);
  readonly gain = new FakeAudioParam(this, 'gain', 0);
  readonly detune = new FakeAudioParam(this, 'detune', 0);
  private t: BiquadFilterType = 'lowpass';
  constructor(ctx: FakeAudioContext) {
    super(ctx, 'biquad');
  }
  get type(): BiquadFilterType {
    return this.t;
  }
  set type(v: BiquadFilterType) {
    if (!FILTER_TYPES.has(v)) throw new TypeError(`bad filter type "${v}"`);
    this.t = v;
  }
}

export class FakeStereoPannerNode extends FakeAudioNode {
  readonly pan = new FakeAudioParam(this, 'pan', 0);
  constructor(ctx: FakeAudioContext) {
    super(ctx, 'panner');
  }
}

export class FakeDelayNode extends FakeAudioNode {
  readonly delayTime = new FakeAudioParam(this, 'delayTime', 0);
  readonly maxDelayTime: number;
  constructor(ctx: FakeAudioContext, max: number) {
    super(ctx, 'delay');
    finite(max, 'createDelay');
    if (!(max > 0 && max < 180)) throw new Error('NotSupportedError: maxDelayTime');
    this.maxDelayTime = max;
  }
}

export class FakeCompressorNode extends FakeAudioNode {
  readonly threshold = new FakeAudioParam(this, 'threshold', -24);
  readonly knee = new FakeAudioParam(this, 'knee', 30);
  readonly ratio = new FakeAudioParam(this, 'ratio', 12);
  readonly attack = new FakeAudioParam(this, 'attack', 0.003);
  readonly release = new FakeAudioParam(this, 'release', 0.25);
  readonly reduction = 0;
  constructor(ctx: FakeAudioContext) {
    super(ctx, 'compressor');
  }
}

export class FakeWaveShaperNode extends FakeAudioNode {
  curve: Float32Array | null = null;
  oversample: OverSampleType = 'none';
  constructor(ctx: FakeAudioContext) {
    super(ctx, 'waveshaper');
  }
}

export class FakeAudioContext {
  currentTime = 0;
  readonly sampleRate: number;
  state: AudioContextState = 'running';
  readonly created: FakeAudioNode[] = [];
  readonly counts: Record<string, number> = {};
  /** Every started source (oscillators and buffer sources), in start order. */
  readonly sources: FakeScheduledSource[] = [];
  /** Sources started at a time already in the past (they would play late / clipped). */
  lateStarts = 0;
  readonly destination: FakeAudioNode;

  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    this.destination = new FakeAudioNode(this, 'destination');
  }

  createGain(): FakeGainNode {
    return new FakeGainNode(this);
  }
  createOscillator(): FakeOscillatorNode {
    return new FakeOscillatorNode(this);
  }
  createBufferSource(): FakeBufferSourceNode {
    return new FakeBufferSourceNode(this);
  }
  createBuffer(channels: number, length: number, sampleRate: number): FakeAudioBuffer {
    return new FakeAudioBuffer(channels, length, sampleRate);
  }
  createBiquadFilter(): FakeBiquadFilterNode {
    return new FakeBiquadFilterNode(this);
  }
  createStereoPanner(): FakeStereoPannerNode {
    return new FakeStereoPannerNode(this);
  }
  createDelay(max = 1): FakeDelayNode {
    return new FakeDelayNode(this, max);
  }
  createDynamicsCompressor(): FakeCompressorNode {
    return new FakeCompressorNode(this);
  }
  createWaveShaper(): FakeWaveShaperNode {
    return new FakeWaveShaperNode(this);
  }
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }

  /** Sources still sounding at `t` (started, and not yet stopped). */
  activeSourcesAt(t = this.currentTime): number {
    let n = 0;
    for (const s of this.sources) if (s.startTime <= t && s.stopTime > t) n++;
    return n;
  }

  /** Typed view for code that expects a real AudioContext. */
  asAudioContext(): AudioContext {
    return this as unknown as AudioContext;
  }
}
