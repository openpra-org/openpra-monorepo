import ButtonWithPopover, {ButtonWithPopoverProps, ButtonWithClosablePopoverProps} from "./ButtonWithPopover";

let props: { iconType: string; isIcon: boolean };


describe("Button", () => {

  beforeEach(()=>{
    props = {
      iconType: "boxesHorizontal",
      isIcon: false
    }
  })

  it("Shows a popover after clicking", () =>{
    cy.mount(<ButtonWithPopover onClick={cy.spy().as('onClick')} {...props} />)
    cy.get('button').click()
    cy.get('@onClick').should('have.been.called')
  })
})

