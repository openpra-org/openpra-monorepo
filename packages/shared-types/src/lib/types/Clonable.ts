interface Clonable<JSON, V> {
  clone(json?: JSON): V;
}
export default Clonable;
