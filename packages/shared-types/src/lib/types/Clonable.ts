export default interface Clonable<JSON, V> {
  clone(json?: JSON): V;
}
