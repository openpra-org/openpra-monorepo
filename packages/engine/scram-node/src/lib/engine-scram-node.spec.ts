import tape from "tape";
import { EngineScramNode } from "./engine-scram-node";

tape("engineScramNode", (t: tape.Test) => {
  t.equal(EngineScramNode(), "engine-scram-node", "test ran");
  t.end();
});
