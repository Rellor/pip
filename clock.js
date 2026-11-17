// For tests only: PIP_CLOCK_SHIFT_MIN moves Pip's clock forward, so many wake-ups in a few seconds behave like real ones
// (8 minutes apart). Without it nothing changes.
const shift = Number(process.env.PIP_CLOCK_SHIFT_MIN || 0) * 60_000;
if (shift) {
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + shift); }
    static now() { return RealDate.now() + shift; }
  };
}
