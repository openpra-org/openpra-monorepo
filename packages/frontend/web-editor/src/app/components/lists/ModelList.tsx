
//TODO:: probably should be moved to API shared types
import GenericItemList from "./GenericItemList";
import GenericListItem from "./GenericListItem";

export type ModelMetadata = {
  title: string,
  description: string,
  id: number,
  lastModified: string,
}

const getFixtures = (count = 100): JSX.Element[] => {
  return Array.from(Array(count).keys()).map((e, i) => {return (<GenericListItem
    key={i}
    label={{
      name: `Model #${i}`,
      description: `This is model number ${i}`,
    }}
    path={`/model/${i}`}
  />)});
}

export default function ModelList(){
  console.log(getFixtures());
  return (
    <GenericItemList>
      {getFixtures()}
    </GenericItemList>
  );
}
