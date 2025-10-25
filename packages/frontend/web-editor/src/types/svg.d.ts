/* eslint-disable import/no-default-export */
declare module "*.svg" {
  const content: string; // EUI <EuiIcon type={content}/> expects a string path/name
  export default content;
}
