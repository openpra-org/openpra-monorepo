import React from 'react'
import {useState} from 'react'
import '../app.module.css'
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
    EuiContextMenuItem,
    EuiContextMenuPanel,
    EuiFieldSearch,
    useGeneratedHtmlId,
    EuiSpacer,
} from "@elastic/eui"
import {euiBackgroundColor} from "@elastic/eui/src/global_styling/mixins/_color";
import ListOption from './listitems/ListOption';

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
    function closeTheme() {
        setThemePopover(false);
    }
    const theme = (
        <EuiButtonEmpty iconType="gear" onClick={themeClick} color="ghost"/>
    )
    const themeItems = [
        /*<EuiContextMenuItem key="cherry" onClick={closeTheme}>Cherry Blueberry</EuiContextMenuItem>,
        <EuiContextMenuItem key="oxide" onClick={closeTheme}>Oxide</EuiContextMenuItem>,*/
        <>
            <ListOption key='cherry' action={closeTheme} label='Cherry Blueberry'/>
            <ListOption key='oxide' action={closeTheme} label='Oxide'/>
        </>
    ]
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
    function closeLang() {
        setLangPopover(false);
    }
    const lang = (
        <EuiButtonEmpty iconType="globe" onClick={langClick} color="ghost"/>
    )
    const langItems = [
        //<EuiContextMenuItem key="english" onClick={closeLang}>English</EuiContextMenuItem>,
        <ListOption key='english' action={closeLang} label='English'/>

    ]

    //
    //Context menu info for account links (user icon top right)
    function accountClick() {
        setAccountPopover(!accountPopover);
    }
    function closeAccount() {
        setAccountPopover(false);
    }
    const account = (
        <EuiButtonEmpty iconType="user" onClick={accountClick} color="ghost"/>
    )
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

    return (

            <EuiPageHeader id='mainHeader' css={{background: euiTheme.colors.primary}}>
                <EuiHeaderSection>
                    <EuiHeaderLogo href='/models'>Models</EuiHeaderLogo>
                </EuiHeaderSection>
                <EuiHeaderSection side="right">
                    <EuiTextColor color="ghost">v0.0.1 </EuiTextColor>
                    <EuiFieldSearch compressed={true}/>
                    <EuiPopover //Theme context menu
                        id={themeContextMenuPopoverId}
                        button={theme}
                        isOpen={themePopover}
                        closePopover={closeTheme}
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

    const [selectPopover, setSelectPopover] = useState(false);
    const selectContextMenuPopoverId = useGeneratedHtmlId({prefix: 'smallContextMenuPopover'})
    const [sortPopover, setSortPopover] = useState(false);
    const sortContextMenuPopoverId = useGeneratedHtmlId({prefix: 'smallContextMenuPopover'})

    //
    //Context menu info for multiple selections/deselections (3 dots top left)
    function selectClick() {
        setSelectPopover(!selectPopover);
    }
    function closeSelect() {
        setSelectPopover(false);
    }
    const select = (
        <EuiButtonEmpty iconType="boxesVertical" onClick={selectClick}/>
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
    function closeSort() {
        setSortPopover(false);
    }
    const sort = (
        <EuiButtonEmpty iconType="filter" iconSide="left" onClick={sortClick}>Sort By</EuiButtonEmpty>
    )
    const sortItems = [
        /**<EuiContextMenuItem key="lastMod" onClick={closeSort}>Last Modified</EuiContextMenuItem>,
        <EuiContextMenuItem key="oldMod" onClick={closeSort}>Oldest Modified</EuiContextMenuItem>,
        <EuiContextMenuItem key="lastCreate" onClick={closeSort}>Last Created</EuiContextMenuItem>,
        <EuiContextMenuItem key="oldCreate" onClick={closeSort}>Oldest Created</EuiContextMenuItem>,
        <EuiContextMenuItem key="a-z" onClick={closeSort}>Title (A-Z)</EuiContextMenuItem>,
        <EuiContextMenuItem key="z-a" onClick={closeSort}>Title (Z-A)</EuiContextMenuItem>,*/
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
        <EuiPageHeader css={{backgroundColor: euiTheme.colors.lightestShade}}>
            <EuiHeaderSection>
                <EuiPopover //Multiple select/deselect context menu
                    id={selectContextMenuPopoverId}
                    button={select}
                    isOpen={selectPopover}
                    closePopover={closeSelect}
                >
                    <EuiContextMenuPanel items={selectItems}/>
                </EuiPopover>
                <EuiPopover //Sort by context menu
                    id={sortContextMenuPopoverId}
                    button={sort}
                    isOpen={sortPopover}
                    closePopover={closeSort}
                >
                    <EuiContextMenuPanel items={sortItems}/>
                </EuiPopover>
                <EuiFieldText placeholder="Filter by name..."/>
                <EuiButtonEmpty iconType="documents"/>
                <EuiButtonEmpty iconType="trash"/>
            </EuiHeaderSection>
            <EuiHeaderSection side="right">
                <EuiButton iconType="plus" size="s">NEW</EuiButton>
            </EuiHeaderSection>
        </EuiPageHeader>
        <EuiSpacer size="xs" />
        <hr/>
            </>
    )
}