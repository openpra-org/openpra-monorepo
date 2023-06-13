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
} from "@elastic/eui"
import {euiBackgroundColor} from "@elastic/eui/src/global_styling/mixins/_color";

export function PageHeader() {
    const {euiTheme} = useEuiTheme();
    return (

            <EuiPageHeader id='mainHeader' css={{background: euiTheme.colors.primary}}>
                <EuiHeaderSection>
                    <EuiButton
                        size="s"
                        href="app.openpra.org"
                    >
                        Models
                    </EuiButton>
                </EuiHeaderSection>
                <EuiHeaderSection side="right">
                    <EuiTextColor css={{color: euiTheme.colors.ghost}}>v0.0.1</EuiTextColor>
                    <EuiFieldSearch compressed={true}/>
                    <EuiButtonEmpty iconType="gear" css={{color: euiTheme.colors.ghost}}/>
                    <EuiButtonEmpty iconType="globe" css={{color: euiTheme.colors.ghost}}/>
                    <EuiButtonEmpty iconType="user" css={{color: euiTheme.colors.ghost}}/>
                </EuiHeaderSection>
            </EuiPageHeader>
    )
}

export function ModelsBar() {
    return (
        <EuiHeader>
            <EuiHeaderLogo>Models</EuiHeaderLogo>
        </EuiHeader>
    )
}

export function Filter() {
    const [selectPopover, setSelectPopover] = useState(false);
    const selectContextMenuPopoverId = useGeneratedHtmlId({prefix: 'smallContextMenuPopover'})
    const [sortPopover, setSortPopover] = useState(false);
    const sortContextMenuPopoverId = useGeneratedHtmlId({prefix: 'smallContextMenuPopover'})


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
        <EuiContextMenuItem key="select" onClick={closeSelect}>Select All</EuiContextMenuItem>,
        <EuiContextMenuItem key="deselect" onClick={closeSelect}>Deselect All</EuiContextMenuItem>
    ]

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
        <EuiContextMenuItem key="lastMod" onClick={closeSort}>Last Modified</EuiContextMenuItem>,
        <EuiContextMenuItem key="oldMod" onClick={closeSort}>Oldest Modified</EuiContextMenuItem>,
        <EuiContextMenuItem key="lastCreate" onClick={closeSort}>Last Created</EuiContextMenuItem>,
        <EuiContextMenuItem key="oldCreate" onClick={closeSort}>Oldest Created</EuiContextMenuItem>,
        <EuiContextMenuItem key="a-z" onClick={closeSort}>Title (A-Z)</EuiContextMenuItem>,
        <EuiContextMenuItem key="z-a" onClick={closeSort}>Title (Z-A)</EuiContextMenuItem>,

    ]

    return (
        <EuiHeader>
            <EuiHeaderSection>
                <EuiPopover
                    id={selectContextMenuPopoverId}
                    button={select}
                    isOpen={selectPopover}
                    closePopover={closeSelect}
                >
                    <EuiContextMenuPanel items={selectItems}/>
                </EuiPopover>
                <EuiPopover
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
        </EuiHeader>
    )
}