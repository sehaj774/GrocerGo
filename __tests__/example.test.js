// A simple function to test
function add(a, b) {
  return a + b;
}

describe('Example Unit Test', () => {
  it('should add two numbers correctly', () => {
    // Assert that the result of add(1, 2) is 3
    expect(add(1, 2)).toBe(3);
    //test
  });

});
