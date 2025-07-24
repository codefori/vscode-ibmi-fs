interface Person {
  name: string;
  age: number;
}

function sortObjectsByProperty(arr: Person[], property: keyof Person, order: 'asc' | 'desc'): Person[] {
  if (order === 'asc') {
    return arr.sort((a, b) => {
      if (a[property] < b[property]) {return -1;}
      if (a[property] > b[property]) {return 1;}
      return 0;
    });
  } else {
    return arr.sort((a, b) => {
      if (a[property] > b[property]) {return -1;}
      if (a[property] < b[property]) {return 1;}
      return 0;
    });
  }
}

const people: Person[] = [
  { name: "Alice", age: 30 },
  { name: "Bob", age: 25 },
  { name: "Charlie", age: 19},
];

// User wants to sort by age in ascending order
const sortedByAgeAsc = sortObjectsByProperty([...people], 'age', 'asc');
console.log("Sorted by Age Ascending:", sortedByAgeAsc);

// User wants to sort by name in descending order
const sortedByNameDesc = sortObjectsByProperty([...people], 'name', 'desc');
console.log("Sorted by Name Descending:", sortedByNameDesc);