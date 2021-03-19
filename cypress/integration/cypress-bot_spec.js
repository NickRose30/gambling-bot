const getTeamNamesSquare = teamName =>
  cy.get('.competitor-name > .name')
    .contains(teamName)
    .first()
    .parent()
    .parent();

const getTeamIndex = teamName =>
  getTeamNamesSquare(teamName)
    .children()
    .first()
    .children()
    .first()
    .invoke('text')
    .then(text => {
      return text === teamName ? 0 : 1;
    });

const getTeamsGameMoneyLines = teamName =>
  getTeamNamesSquare(teamName)
    .parent()
    .parent()
    .parent()
    .next()
    .children()
    .eq(1);

describe(`Placing bet for ${Cypress.env('teamName')}`, () => {
  beforeEach(() => {
    console.log(Cypress.env('teamName'));
    cy.visit('https://www.bovada.lv/');
    cy.get('#headerUnloggedLogin').click();
    cy.get('#email').clear().type(Cypress.env('username'));
    cy.get('#login-password').clear().type(Cypress.env('password'));
    cy.get('#login-submit').click();
    cy.wait(7000);
  });
  afterEach(() => {
    cy.get('button.account-balance.menu-btn').click();
    cy.get('button.account-logout-button').click();
  });
  it('Execute bet placement', () => {
    cy.get('a[title=Sports]').click({ force: true });
    cy.get('[slug=sports-quick-links]').within(_ => {
      cy.contains('NHL').click();
    });
    cy.wait(7000);
    getTeamIndex(Cypress.env('teamName')).then(idx => {
      getTeamsGameMoneyLines(Cypress.env('teamName')).find('li').eq(idx).click();
      cy.get('#default-input--risk').clear().type(Cypress.env('betAmount'));
      cy.get('button.place-bets').click();
    });
    cy.wait(3000);
  });
});