import { describe, expect, it, vi } from 'vitest';
import { startPassthrough } from './passthrough';

function fakes() {
  const destination = {};
  const source = { connect: vi.fn() };
  const ctx = {
    destination,
    state: 'running' as AudioContextState,
    createMediaStreamSource: vi.fn(() => source),
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  return { destination, source, ctx, track, stream };
}

describe('startPassthrough', () => {
  it('routes the stream to the speakers', () => {
    const { destination, source, ctx, stream } = fakes();
    startPassthrough(stream, () => ctx as unknown as AudioContext);
    expect(ctx.createMediaStreamSource).toHaveBeenCalledWith(stream);
    expect(source.connect).toHaveBeenCalledWith(destination);
  });

  it('stop() ends the capture and closes the context', async () => {
    const { ctx, track, stream } = fakes();
    const stop = startPassthrough(stream, () => ctx as unknown as AudioContext);
    await stop();
    expect(track.stop).toHaveBeenCalled();
    expect(ctx.close).toHaveBeenCalled();
  });

  it('resumes a suspended context', () => {
    const { ctx, stream } = fakes();
    ctx.state = 'suspended';
    startPassthrough(stream, () => ctx as unknown as AudioContext);
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('does not resume a running context', () => {
    const { ctx, stream } = fakes();
    startPassthrough(stream, () => ctx as unknown as AudioContext);
    expect(ctx.resume).not.toHaveBeenCalled();
  });

  it('stop() is idempotent', async () => {
    const { ctx, track, stream } = fakes();
    const stop = startPassthrough(stream, () => ctx as unknown as AudioContext);
    await stop();
    await stop();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(ctx.close).toHaveBeenCalledTimes(1);
  });
});
