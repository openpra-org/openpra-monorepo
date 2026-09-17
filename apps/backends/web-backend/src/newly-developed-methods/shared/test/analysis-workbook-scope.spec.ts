import { loadWorkbookSnapshot, WithWorkbookSnapshots } from "../analysis-workbook-scope";

it("shares one source read within a run while isolating overlapping runs", async () => {
  let revision = 0;
  const read = jest.fn(async () => ({ revision: ++revision }));
  class Execution {
    @WithWorkbookSnapshots()
    async run() {
      const first = await loadWorkbookSnapshot("SY:one", read);
      await Promise.resolve();
      const second = await loadWorkbookSnapshot("SY:one", read);
      return [first, second];
    }
  }
  const [a, b] = await Promise.all([new Execution().run(), new Execution().run()]);
  expect(a[0]).toBe(a[1]);
  expect(b[0]).toBe(b[1]);
  expect(a[0]).not.toBe(b[0]);
  expect(read).toHaveBeenCalledTimes(2);
});
