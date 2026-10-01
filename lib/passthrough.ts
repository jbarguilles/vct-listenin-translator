/**
 * Plays a captured tab stream back to the speakers so the tab isn't muted
 * while Armed. Returns a function that ends the capture.
 */
export function startPassthrough(
  stream: MediaStream,
  makeContext: () => AudioContext = () => new AudioContext(),
): () => Promise<void> {
  const ctx = makeContext();
  ctx.createMediaStreamSource(stream).connect(ctx.destination);
  // Autoplay policy can start the context suspended, which would be silent.
  if (ctx.state === 'suspended') void ctx.resume();
  let stopping: Promise<void> | undefined;
  return () =>
    (stopping ??= (async () => {
      for (const track of stream.getTracks()) track.stop();
      await ctx.close();
    })());
}
