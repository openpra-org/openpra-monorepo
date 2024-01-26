import { signup } from "../selectors/signup.css";
import { header } from "../selectors/header.css";

describe('Signup', () => {
  // https://docs.cypress.io/guides/core-concepts/variables-and-aliases.html#Aliases
  // using let is not neccessary and we use aliases in beforeEach instead
  // let username
  // let email

  beforeEach(() => {
    // we need random username and email each test
    const random = `cy${Math.random().toString().slice(2, 8)}`
    // use alias instead of let
    cy.wrap(random).as('username')
    cy.wrap(`${random}@gmail.com`).as('email')
    cy.visit('/')
  })

  // https://docs.cypress.io/guides/core-concepts/variables-and-aliases.html#Avoiding-the-use-of-this
  // if we want to access alias in test, we need to change arrow function => to function ()
  it('can register a new account', function () {
    // added delay as sometimes it can make tests flaky if typing too fast (default is 10)
    cy.get(signup.firstName).type('cypress')
    cy.get(signup.lastName).type('press')
    cy.get(signup.emailField).type(this.email)
    cy.get(signup.usernameField).type(this.username, { delay: 10 })
    cy.get(signup.passwordField).eq(0).type('Cypress12')
    cy.get(signup.passwordField).eq(1).type('Cypress12')
    cy.get(signup.signUpButton).click()
    cy.get(header.settingsLink).should('be.visible')
  })
})
