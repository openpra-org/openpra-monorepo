import { esqStableId } from "../esq/esq-run-inputs";

function functionalEventBindingId(functionalEventId: string): string {
  return esqStableId(`es-functional-event:${functionalEventId}`);
}

export { functionalEventBindingId };
