import tape from "tape";
import { engineScramNode } from "./engine-scram-node";

tape("engineScramNode", (t: tape.Test) => {
  t.equal(engineScramNode(), "engine-scram-node", "test ran");
  t.end();
});
