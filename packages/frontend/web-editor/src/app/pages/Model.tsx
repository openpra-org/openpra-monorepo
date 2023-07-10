import { useLoaderData, useRouteLoaderData } from "react-router-dom";
import { ModelProps } from "./ModelsPage";

export default function Model() {
  const model = useLoaderData();
  console.log(model);
  return <p>I'm a model page with modelId `${model}`</p>
}
