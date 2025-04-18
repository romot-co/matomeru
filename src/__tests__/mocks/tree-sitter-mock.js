// tree-sitter-mock.js
class MockParser {
  constructor() {
    this.setLanguage = jest.fn();
    this.parse = jest.fn().mockReturnValue({
      rootNode: {
        descendantsOfType: jest.fn().mockImplementation((type) => {
          if (type === 'comment') {
            return [
              { startIndex: 0, endIndex: 6 },    // "// abc"
              { startIndex: 19, endIndex: 29 }   // "/* test */"
            ];
          }
          return [];
        })
      }
    });
  }
}

MockParser.init = jest.fn().mockResolvedValue(undefined);

const mockLanguage = {};
MockParser.Language = {
  load: jest.fn().mockResolvedValue(mockLanguage)
};

module.exports = MockParser; 