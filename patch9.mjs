import fs from 'fs';
let html = fs.readFileSync('index.html', 'utf8');

// Insert a helper function before `window.addNewComplementGroup` or somewhere around there
const helper = `
    async function getComplementDoc(ref, id) {
      try {
        const snap = await getDoc(ref);
        return snap;
      } catch (e) {
        if (activeComplementsMap[id]) {
          return {
            exists: () => true,
            data: () => activeComplementsMap[id]
          };
        }
        return { exists: () => false, data: () => null };
      }
    }
`;

html = html.replace('    window.addNewComplementGroup = async function() {', helper + '    window.addNewComplementGroup = async function() {');

// Now replace all `await getDoc(compRef)` to `await getComplementDoc(compRef, activeComplementProduct.id)`
html = html.replace(/await getDoc\(compRef\)/g, 'await getComplementDoc(compRef, activeComplementProduct.id)');
html = html.replace(/await getDoc\(docRef\)/g, 'await getComplementDoc(docRef, activeComplementProduct.id)');

fs.writeFileSync('index.html', html);
console.log("Replaced successfully!");
