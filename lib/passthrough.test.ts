import { describe, expect, it, vi } from 'vitest';
import { startPassthrough } from './passthrough';

function fakes() {
  const destination = {};
  const source = { connect: vi.fn() };
  const ctx = {
    destination,
    createMediaStreamSource: vi.fn(() => source),
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
});
