describe('The Home Page', () => {
  /*it('successfully loads', () => {
    cy.visit('/') // change URL to match your dev URL
  })*/

  //String
  //let Token;

  it('successfully obtains a token', () => {
    cy.request('POST','/api/auth/token-obtain/',{
      "username": "test2",
      "password": "1234"
    }).then((response) => {
      expect(response.body).to.have.property('token')
      //Token = response.body.token
    })
  })

  it('successfully obtains the models list', () => {
    cy.request({
      method:'GET',
      url:'/api/collab/model/?type=hcl',
      headers: {'Authorization':'JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3QyIiwiZW1haWwiOiJ3aWxzb254NjFAb3V0bG9vay5jb20iLCJpYXQiOjE2OTA1MDkyNjgsImV4cCI6MTY5MDU5NTY2OH0.qJGeQ5T32Plc6q1ham4_oeRFgZvkggVc7FjNdAsL8XE'}
    }).then((response) => {
      expect(response.body.count).to.eq(0)
      expect(response.body.next).to.eq(null)
      expect(response.body.previous).to.eq(null)
      //expect(response.body.results).to.eq([])
    })
  })
})