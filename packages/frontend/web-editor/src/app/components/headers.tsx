import React from 'react'
import {useState} from 'react'
import {
    EuiPageHeader,
    EuiHeader,
    EuiButton,
    EuiButtonEmpty,
    EuiFieldText,
    EuiHeaderSection,
    EuiHeaderLogo,
    EuiPopover,
    EuiContextMenuItem,
    EuiContextMenuPanel,
    EuiFieldSearch,
    useGeneratedHtmlId,
    EuiIcon
} from "@elastic/eui"

export function PageHeader() {
    return (
        <div>
            <EuiPageHeader>
                <EuiHeaderSection>
                    <EuiButton
                        size="s"
                        href="app.openpra.org"
                    >
                        Models
                    </EuiButton>
                </EuiHeaderSection>
                <EuiHeaderSection side="right">
                    <p>v0.0.1</p>
                    <EuiFieldSearch/>
                    <EuiButtonEmpty iconType="gear"/>
                    <EuiButtonEmpty iconType="globe"/>
                    <EuiButtonEmpty iconType="user"/>
                </EuiHeaderSection>
            </EuiPageHeader>
        </div>
    )
}

export function Models() {
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