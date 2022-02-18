
function cold() {

}
cold();

function hot() {
  let sum = 0;
  for(let i = 0; i < 100; i++) {
    sum += i;
  }
  return sum;
}

let sumSum = 0;
for(let n = 0; n < 1000; n++)
  sumSum += hot();

console.log("sumSum", sumSum);
