import { EuiPageTemplate } from "@elastic/eui";
import { NewItemButton } from "../buttons/newItemButton";

interface PageTitleHeaderProps {
    title: string;
    icon: string;
}

//page header to be used on items with a list, differentiated by having the New Item button
//they are seperate because we could add a boolean or something to toggle it, but might be an issue if setting a prop
export default function ListPageTitleHeader({title, icon}: PageTitleHeaderProps){
    return (
        <EuiPageTemplate.Header
          alignItems="center"
          pageTitle={title.concat('s')}
          iconProps={{
            size: "xxl",
            color: "accent"
          }}
          responsive={false}
          bottomBorder={true}
          iconType={icon}
          rightSideItems={[
            <NewItemButton title={title}/>
          ]}
        />
    );
}