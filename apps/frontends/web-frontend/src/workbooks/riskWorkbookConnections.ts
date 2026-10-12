function meanFrequencyValue(value: number | { value: number }): number {
  return typeof value === "number" ? value : value.value;
}

export { meanFrequencyValue };
