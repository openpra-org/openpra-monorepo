/* eslint-disable import/no-default-export */
declare module "*.png" {
  const content: string; // used as <img src={content} />
  export default content;
}
