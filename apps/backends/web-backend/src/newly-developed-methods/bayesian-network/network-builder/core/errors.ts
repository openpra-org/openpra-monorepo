class NetworkBuilderError extends Error {
  readonly kind: string;

  constructor(kind: string, message: string) {
    super(message);
    this.kind = kind;
    this.name = kind;
  }
}

const valueError = (message: string): NetworkBuilderError => new NetworkBuilderError("ValueError", message);

const typeError = (message: string): NetworkBuilderError => new NetworkBuilderError("TypeError", message);

const quoteKeyMessage = (message: string): string => {
  const quote = message.includes("'") && !message.includes('"') ? '"' : "'";
  let output = quote;
  for (const character of Array.from(message)) {
    if (character === "\\") output += "\\\\";
    else if (character === quote) output += `\\${quote}`;
    else if (character === "\n") output += "\\n";
    else output += character;
  }
  return output + quote;
};

const keyError = (message: string): NetworkBuilderError =>
  new NetworkBuilderError("KeyError", quoteKeyMessage(message));

const crossLayerContractError = (message: string): NetworkBuilderError =>
  new NetworkBuilderError("CrossLayerContractError", message);

const domainSpecError = (message: string): NetworkBuilderError => new NetworkBuilderError("DomainSpecError", message);

export { NetworkBuilderError, crossLayerContractError, domainSpecError, keyError, typeError, valueError };
