/* Practice database: the three tables from the HSC Course Specifications (Games, Publishers, Developers).
   Column names match the Specifications' diagram. All data is fictional. Dates are stored as YYYY-MM-DD text,
   which is what SQLite needs to compare dates correctly. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PRACTICE_DB = factory();
})(this, function () {
  "use strict";
  return {
    Publishers: {
      cols: [
        { name: "Publisher_ID", type: "num", key: "P" },
        { name: "Name", type: "text" }
      ],
      rows: [
        { Publisher_ID: 1, Name: "Games Inc" },
        { Publisher_ID: 2, Name: "Pixel Press" },
        { Publisher_ID: 3, Name: "Nova Interactive" },
        { Publisher_ID: 4, Name: "Lantern Works" }
      ]
    },
    Developers: {
      cols: [
        { name: "Developer_ID", type: "num", key: "P" },
        { name: "First_name", type: "text" },
        { name: "Last_name", type: "text" }
      ],
      rows: [
        { Developer_ID: 1, First_name: "Ava", Last_name: "Chen" },
        { Developer_ID: 2, First_name: "Ben", Last_name: "Okafor" },
        { Developer_ID: 3, First_name: "Chloe", Last_name: "Martin" },
        { Developer_ID: 4, First_name: "Dev", Last_name: "Patel" },
        { Developer_ID: 5, First_name: "Ella", Last_name: "Nguyen" },
        { Developer_ID: 6, First_name: "Finn", Last_name: "Murphy" }
      ]
    },
    Games: {
      cols: [
        { name: "ID", type: "num", key: "P" },
        { name: "Name", type: "text" },
        { name: "Release_date", type: "date" },
        { name: "Cost", type: "num" },
        { name: "Publisher_ID", type: "num", key: "F" },
        { name: "Developer_ID", type: "num", key: "F" }
      ],
      rows: [
        { ID: 1, Name: "Star Drifter", Release_date: "2021-11-05", Cost: 40, Publisher_ID: 1, Developer_ID: 1 },
        { ID: 2, Name: "Pixel Quest", Release_date: "2022-03-01", Cost: 25, Publisher_ID: 2, Developer_ID: 2 },
        { ID: 3, Name: "Dungeon Dash", Release_date: "2022-03-15", Cost: 30, Publisher_ID: 1, Developer_ID: 3 },
        { ID: 4, Name: "Cosmic Cafe", Release_date: "2022-06-20", Cost: 20, Publisher_ID: 3, Developer_ID: 1 },
        { ID: 5, Name: "Mech Arena", Release_date: "2022-09-09", Cost: 60, Publisher_ID: 1, Developer_ID: 4 },
        { ID: 6, Name: "Tiny Tides", Release_date: "2022-12-02", Cost: 15, Publisher_ID: 2, Developer_ID: 2 },
        { ID: 7, Name: "Rogue Rails", Release_date: "2023-01-27", Cost: 35, Publisher_ID: 1, Developer_ID: 3 },
        { ID: 8, Name: "Galaxy Golf", Release_date: "2023-03-31", Cost: 20, Publisher_ID: 3, Developer_ID: 5 },
        { ID: 9, Name: "Haunted Harbour", Release_date: "2023-03-10", Cost: 45, Publisher_ID: 2, Developer_ID: 1 },
        { ID: 10, Name: "Neon Nights", Release_date: "2023-05-18", Cost: 50, Publisher_ID: 1, Developer_ID: 4 },
        { ID: 11, Name: "Cloud Kingdom", Release_date: "2023-08-04", Cost: 30, Publisher_ID: 4, Developer_ID: 5 },
        { ID: 12, Name: "Block Builder", Release_date: "2023-10-12", Cost: 25, Publisher_ID: 3, Developer_ID: 2 },
        { ID: 13, Name: "Samurai Sprint", Release_date: "2023-11-24", Cost: 55, Publisher_ID: 1, Developer_ID: 3 },
        { ID: 14, Name: "Garden Gnomes", Release_date: "2024-02-16", Cost: 15, Publisher_ID: 4, Developer_ID: 5 },
        { ID: 15, Name: "Space Pirates", Release_date: "2024-04-05", Cost: 40, Publisher_ID: 1, Developer_ID: 1 },
        { ID: 16, Name: "Ocean Odyssey", Release_date: "2024-07-19", Cost: 30, Publisher_ID: 2, Developer_ID: 4 },
        { ID: 17, Name: "Arcade Planet", Release_date: "2022-03-01", Cost: 20, Publisher_ID: 3, Developer_ID: 5 }
      ]
    }
  };
});
