import {useState} from 'react'
import {
    EuiPageHeader,
    EuiHeader,
    EuiButton,
    EuiButtonEmpty,
    EuiFieldText,
    EuiHeaderSection,
    EuiHeaderLogo,
    useEuiTheme,
    EuiTextColor,
    EuiPopover,
    EuiContextMenuPanel,
    EuiFieldSearch,
    useGeneratedHtmlId,
    EuiSpacer,
    EuiOverlayMask,
} from "@elastic/eui"
import ListOption from "../listitems/listOption";
import NewItem from './newItem';

export function PageHeader() {
    //Allows the use of the css prop in Eui tags
    const {euiTheme} = useEuiTheme();

    //States for context menus being on/off
    const [themePopover, setThemePopover] = useState(false);
    const themeContextMenuPopoverId = useGeneratedHtmlId({prefix: 'smallContextMenuPopover'})
    const [langPopover, setLangPopover] = useState(false);
    const langContextMenuPopoverId = useGeneratedHtmlId({prefix: 'smallContextMenuPopover'})
    const [accountPopover, setAccountPopover] = useState(false);
    const accountContextMenuPopoverId = useGeneratedHtmlId({prefix: 'smallContextMenuPopover'})

    //
    //Context menu info for the themes (gear icon top right)
    function themeClick() {
        setThemePopover(!themePopover);
    }

    //closes the theme menu
    function closeTheme() {
        setThemePopover(false);
    }

    //this is the button that opens up the theme menu
    //css was the only way to have adaptable colors based on dark/light mode
    const theme = (
        <EuiButtonEmpty iconType="gear" onClick={themeClick} css={{color: euiTheme.colors.darkestShade}}/>
    )

    //this is a list of ListOptions for the different themes
    const themeItems = [
        /*<EuiContextMenuItem key="cherry" onClick={closeTheme}>Cherry Blueberry</EuiContextMenuItem>,
        <EuiContextMenuItem key="oxide" onClick={closeTheme}>Oxide</EuiContextMenuItem>,*/
        <>
            <ListOption key='cherry' action={closeTheme} label='Cherry Blueberry'/>
            <ListOption key='oxide' action={closeTheme} label='Oxide'/>
        </>
    ]

    //this is a list of the different items for dark/light code
    const modeItems = [
        <EuiPageHeader>
            <EuiButton>Auto</EuiButton>
            <EuiButton>Dark</EuiButton>
            <EuiButton>Light</EuiButton>
        </EuiPageHeader>
    ]

    //
    //Context menu info for language selection (globe icon top right)
    function langClick() {
        setLangPopover(!langPopover);
    }

    //closes the language menu
    function closeLang() {
        setLangPopover(false);
    }

    //language button defined up here
    const lang = (
        <EuiButtonEmpty iconType="globe" onClick={langClick} css={{color: euiTheme.colors.darkestShade}}/>
    )

    //ListOptions of languages, laregly empty for now
    const langItems = [
        //<EuiContextMenuItem key="english" onClick={closeLang}>English</EuiContextMenuItem>,
        <ListOption key='english' action={closeLang} label='English'/>

    ]

    //
    //Context menu info for account links (user icon top right)
    function accountClick() {
        setAccountPopover(!accountPopover);
    }

    //closes the acount submenu
    function closeAccount() {
        setAccountPopover(false);
    }

    //this is the account button
    const account = (
        <EuiButtonEmpty iconType="user" onClick={accountClick} css={{color: euiTheme.colors.darkestShade}}/>
    )

    //ListOption of account items, such as admin, logout, and profile
    const accountItems = [
        /*<EuiContextMenuItem key="profile" onClick={closeAccount}>Profile</EuiContextMenuItem>,
        <EuiContextMenuItem key="admin" onClick={closeAccount}>Admin</EuiContextMenuItem>,
        <EuiContextMenuItem key="logout" onClick={closeAccount}>Logout</EuiContextMenuItem>,*/
        <>
            <ListOption key='profile' action={closeAccount} label='Profile'/>
            <ListOption key='admin' action={closeAccount} label='Admin'/>
            <ListOption key='logout' action={closeAccount} label='Logout'/>
        </>
    ]

    const currentPath = window.location.pathname;



    return (
        
        //general main header, not the filter header
        <EuiPageHeader id='mainHeader' css={{background: euiTheme.colors.lightestShade}}>
            <EuiHeaderSection>
                {/** these are the major tabs at the top, the .incldues it so make it so they stay filled when on a page that is under that tab */}
                <EuiButton href='models'
                           css={{backgroundColor: currentPath.includes('/models') || currentPath.includes('/model') ? euiTheme.colors.mediumShade: euiTheme.colors.lightestShade, color: euiTheme.colors.darkestShade}}
                >
                    Models
                </EuiButton>
                <EuiButton href='data'
                           css={{backgroundColor: currentPath.includes('/data') ? euiTheme.colors.mediumShade: euiTheme.colors.lightestShade, color: euiTheme.colors.darkestShade}}
                >
                    Data
                </EuiButton>
            </EuiHeaderSection>
            {/** Style here is to largely center the text */}
            <EuiHeaderSection side="right" style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                <EuiTextColor color="darkestShade" style={{ marginRight: '8px' }}>v0.0.1</EuiTextColor>
                <EuiFieldSearch compressed={true}/>
                <EuiPopover //Theme context menu
                    id={themeContextMenuPopoverId}
                    button={theme}
                    isOpen={themePopover}
                    closePopover={closeTheme}
                    //Added an extra margin here to make the top page look more spaced out and clean
                    style={{ marginLeft: '8px'}}
                >
                    <EuiContextMenuPanel items={themeItems}/>
                </EuiPopover>
                <EuiPopover //Language context menu
                    id={langContextMenuPopoverId}
                    button={lang}
                    isOpen={langPopover}
                    closePopover={closeLang}
                >
                    <EuiContextMenuPanel items={langItems}/>
                </EuiPopover>
                <EuiPopover //Account context menu
                    id={accountContextMenuPopoverId}
                    button={account}
                    isOpen={accountPopover}
                    closePopover={closeAccount}
                >
                    <EuiContextMenuPanel items={accountItems}/>
                </EuiPopover>
            </EuiHeaderSection>
        </EuiPageHeader>
    )
}

//ModelsBar NOT IN USE
export function ModelsBar() {
    return (
        <EuiHeader>
            <EuiHeaderLogo href='/models'>Models</EuiHeaderLogo>
        </EuiHeader>
    )
}

//Header with sorting options and the "new" model button
export function Filter() {
    //Allows the use of the css prop in Eui tags
    const {euiTheme} = useEuiTheme();

    //different states that are being used in filter for the popover menus
    const [selectPopover, setSelectPopover] = useState(false);
    const selectContextMenuPopoverId = useGeneratedHtmlId({prefix: 'smallContextMenuPopover'})
    const [sortPopover, setSortPopover] = useState(false);
    const sortContextMenuPopoverId = useGeneratedHtmlId({prefix: 'smallContextMenuPopover'})

    //
    //Context menu info for multiple selections/deselections (3 dots top left)
    function selectClick() {
        setSelectPopover(!selectPopover);
    }

    //closes select context
    function closeSelect() {
        setSelectPopover(false);
    }

    //selects?
    const select = (
        <EuiButtonEmpty iconType="boxesVertical" onClick={selectClick} css={{color: euiTheme.colors.darkShade}}/>
    )
    const selectItems = [
        /*<EuiContextMenuItem key="select" onClick={closeSelect}>Select All</EuiContextMenuItem>,
        <EuiContextMenuItem key="deselect" onClick={closeSelect}>Deselect All</EuiContextMenuItem>*/
        <>
            <ListOption key='select' action={closeSelect} label='Select All'/>
            <ListOption key='deselect' action={closeSelect} label='Deselect All'/>
        </>
    ]

    //
    //Context menu info for sorting ("sort by" button top left
    function sortClick() {
        setSortPopover(!sortPopover);
    }

    //closes the sort function that is currently being used
    function closeSort() {
        setSortPopover(false);
    }
    const sort = (
        <EuiButtonEmpty iconType="filter" iconSide="left" onClick={sortClick} css={{color: euiTheme.colors.darkShade}}>Sort By</EuiButtonEmpty>
    )

    //list of sort items, they are made as list options because they are immutable, the action 
    //should eventually call different sorts of data in ModelItemsList
    const sortItems = [
        <>
            <ListOption key="lastMod" action={closeSort} label="Last Modified" />
            <ListOption key="oldMod" action={closeSort} label="Oldest Modified" />
            <ListOption key="lastCreate" action={closeSort} label="Last Created" />
            <ListOption key="oldCreate" action={closeSort} label="Oldest Created" />
            <ListOption key="a-z" action={closeSort} label="Title (A-Z)" />
            <ListOption key="z-a" action={closeSort} label="Title (Z-A)" />
        </> 
    ]

    return (
        <>
        <EuiSpacer size="xs" />
        <EuiPageHeader>
            <EuiHeaderSection>
                <EuiPopover //Sort by context menu
                    id={sortContextMenuPopoverId}
                    button={sort}
                    isOpen={sortPopover}
                    closePopover={closeSort}
                >
                    <EuiContextMenuPanel items={sortItems}/>
                </EuiPopover>
                <EuiFieldText placeholder="Filter by name..."/>
                {/*<EuiButtonEmpty iconType="documents"/>*/}
                    {/*<EuiButtonEmpty iconType="trash"/>*/}
            </EuiHeaderSection>
            <EuiHeaderSection side="right">
                <EuiButton iconType="plus" href = 'model/new' size="s" color='text' style={{opacity: '2'}}>NEW</EuiButton>
            </EuiHeaderSection>
        </EuiPageHeader>
        <EuiSpacer size="xs" />
        <hr/>
            </>
    )
}


//list of props passed in, the users is optional and controls which version is shown, this is so we can reuse this structure later
export interface NewItemProps {
    title: string
    page: string
}

export function ModelPageFilter(props: NewItemProps) {

    //this is to make sure the new thing gets set
    const [addNewVisible, setAddNewVisible] = useState(false);

    function onNewClick(){
        setAddNewVisible(!addNewVisible)
    }

    //Allows the use of the css prop in Eui tags
    const {euiTheme} = useEuiTheme();

    //
    const { title, page } = props;

    //different states that are being used in filter for the popover menus
    const [selectPopover, setSelectPopover] = useState(false);
    const selectContextMenuPopoverId = useGeneratedHtmlId({prefix: 'smallContextMenuPopover'})
    const [sortPopover, setSortPopover] = useState(false);
    const sortContextMenuPopoverId = useGeneratedHtmlId({prefix: 'smallContextMenuPopover'})

    //
    //Context menu info for multiple selections/deselections (3 dots top left)
    function selectClick() {
        setSelectPopover(!selectPopover);
    }

    //closes select context
    function closeSelect() {
        setSelectPopover(false);
    }

    //selects?
    const select = (
        <EuiButtonEmpty iconType="boxesVertical" onClick={selectClick} css={{color: euiTheme.colors.darkShade}}/>
    )
    const selectItems = [
        /*<EuiContextMenuItem key="select" onClick={closeSelect}>Select All</EuiContextMenuItem>,
        <EuiContextMenuItem key="deselect" onClick={closeSelect}>Deselect All</EuiContextMenuItem>*/
        <>
            <ListOption key='select' action={closeSelect} label='Select All'/>
            <ListOption key='deselect' action={closeSelect} label='Deselect All'/>
        </>
    ]

    //
    //Context menu info for sorting ("sort by" button top left
    function sortClick() {
        setSortPopover(!sortPopover);
    }

    //closes the sort function that is currently being used
    function closeSort() {
        setSortPopover(false);
    }
    const sort = (
        <EuiButtonEmpty iconType="filter" iconSide="left" onClick={sortClick} css={{color: euiTheme.colors.darkShade}}>Sort By</EuiButtonEmpty>
    )

    //list of sort items, they are made as list options because they are immutable, the action
    //should eventually call different sorts of data in ModelItemsList
    const sortItems = [
        <>
            <ListOption key="lastMod" action={closeSort} label="Last Modified" />
            <ListOption key="oldMod" action={closeSort} label="Oldest Modified" />
            <ListOption key="lastCreate" action={closeSort} label="Last Created" />
            <ListOption key="oldCreate" action={closeSort} label="Oldest Created" />
            <ListOption key="a-z" action={closeSort} label="Title (A-Z)" />
            <ListOption key="z-a" action={closeSort} label="Title (Z-A)" />
        </>
    ]

    //the padding here is to give it a nice borderwithout messing up how any of the other page elements will look when implemented
    return (
        <>
            <div style={{ padding: '0 8px' }}>

                {/** the pixel margin here is to make it appear where we want it, at least for right now
                 * I couldnt figure out how to pass it to the other page
                */}
                <EuiPageHeader style={{marginTop: '-20px'}}>
                    <EuiHeaderSection>
                        <EuiPopover //Sort by context menu
                            id={sortContextMenuPopoverId}
                            button={sort}
                            isOpen={sortPopover}
                            closePopover={closeSort}
                        >
                            <EuiContextMenuPanel items={sortItems}/>
                        </EuiPopover>
                        <EuiFieldText placeholder="Filter by name..."/>
                        {/*<EuiButtonEmpty iconType="documents"/>*/}
                        {/*<EuiButtonEmpty iconType="trash"/>*/}
                    </EuiHeaderSection>
                    <EuiHeaderSection side="right">
                        <EuiButton iconType="plus" onClick={onNewClick} size="s" color='text' style={{opacity: '2'}}>NEW</EuiButton>
                    </EuiHeaderSection>
                </EuiPageHeader>
                <EuiSpacer size="xs" />
                <hr/>
            </div>
            {addNewVisible && (
                <EuiOverlayMask>
                    <NewItem title={title} page={page}/>
                </EuiOverlayMask>
            )}
        </>
    )
}