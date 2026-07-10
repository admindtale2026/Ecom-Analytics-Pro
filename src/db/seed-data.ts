/**
 * Static reference data for the seed: Indian geography (with coordinates for
 * the map), product taxonomy, salespeople, and name pools. Kept separate from
 * seed.ts so it can also feed the city_geo table and tests.
 */

export type GeoCity = {
  city: string;
  state: string;
  lat: number;
  lng: number;
  weight: number; // relative order volume
};

// Cities seen across the reference dashboards, with real lat/lng and a
// weight that reproduces the observed state dominance (MH, TG, KA, KL lead).
export const GEO: GeoCity[] = [
  { city: "Mumbai", state: "Maharashtra", lat: 19.076, lng: 72.877, weight: 30 },
  { city: "Pune", state: "Maharashtra", lat: 18.52, lng: 73.856, weight: 10 },
  { city: "Nagpur", state: "Maharashtra", lat: 21.146, lng: 79.088, weight: 4 },
  { city: "Hyderabad", state: "Telangana", lat: 17.385, lng: 78.486, weight: 34 },
  { city: "Bengaluru", state: "Karnataka", lat: 12.972, lng: 77.594, weight: 22 },
  { city: "Mangalore", state: "Karnataka", lat: 12.914, lng: 74.856, weight: 5 },
  { city: "Calicut", state: "Kerala", lat: 11.258, lng: 75.78, weight: 12 },
  { city: "Kochi", state: "Kerala", lat: 9.931, lng: 76.267, weight: 8 },
  { city: "Muvattupuzha", state: "Kerala", lat: 9.98, lng: 76.58, weight: 4 },
  { city: "Thiruvananthapuram", state: "Kerala", lat: 8.524, lng: 76.936, weight: 5 },
  { city: "Ahmedabad", state: "Gujarat", lat: 23.022, lng: 72.571, weight: 8 },
  { city: "Sarigam", state: "Gujarat", lat: 20.28, lng: 72.9, weight: 3 },
  { city: "Jamnagar", state: "Gujarat", lat: 22.47, lng: 70.057, weight: 3 },
  { city: "Chennai", state: "Tamil Nadu", lat: 13.082, lng: 80.27, weight: 14 },
  { city: "Coimbatore", state: "Tamil Nadu", lat: 11.016, lng: 76.955, weight: 5 },
  { city: "Panaji", state: "Goa", lat: 15.49, lng: 73.827, weight: 7 },
  { city: "Delhi", state: "Delhi", lat: 28.704, lng: 77.102, weight: 9 },
  { city: "Gurgaon", state: "Haryana", lat: 28.459, lng: 77.026, weight: 7 },
  { city: "Noida", state: "Uttar Pradesh", lat: 28.535, lng: 77.391, weight: 6 },
  { city: "Lucknow", state: "Uttar Pradesh", lat: 26.847, lng: 80.947, weight: 3 },
  { city: "Chandigarh", state: "Punjab", lat: 30.733, lng: 76.779, weight: 4 },
  { city: "Dehradun", state: "Uttarakhand", lat: 30.317, lng: 78.032, weight: 3 },
  { city: "Patna", state: "Bihar", lat: 25.594, lng: 85.137, weight: 2 },
  { city: "Kolkata", state: "West Bengal", lat: 22.573, lng: 88.364, weight: 5 },
  { city: "Jaipur", state: "Rajasthan", lat: 26.912, lng: 75.787, weight: 5 },
  { city: "Indore", state: "Madhya Pradesh", lat: 22.719, lng: 75.857, weight: 3 },
  { city: "Bhubaneswar", state: "Odisha", lat: 20.296, lng: 85.824, weight: 2 },
];

export const SALESPEOPLE = [
  "Lijith",
  "Santhosh",
  "Talu",
  "Ashlin",
  "Anjana",
  "Faisal",
  "RK",
  "Adarsh",
  "Amal",
  "Deepa",
  "Jikky",
  "Sajeesh",
  "Saju",
  "Shikha",
  "Swetha",
  "Website", // online / self-serve channel
];

// Product type -> [minUnitPrice, maxUnitPrice, relativeWeight]
export const PRODUCT_TYPES: Record<string, [number, number, number]> = {
  Custom: [5000, 45000, 22],
  "Accent | Lounge Chairs": [25000, 120000, 16],
  sofa: [80000, 250000, 14],
  "Dining Chairs": [8000, 30000, 12],
  Console: [40000, 95000, 8],
  "Bed Cot": [60000, 185000, 7],
  "Coffee Table": [20000, 70000, 8],
  tables: [15000, 115000, 6],
  "End Tables": [12000, 30000, 6],
  "Corner Sofa": [150000, 260000, 3],
  "Bed side Table": [8000, 30000, 5],
  Lightings: [5000, 25000, 6],
  Benches: [20000, 60000, 4],
  "Shoe Racks": [15000, 75000, 3],
  "Clearance Sales": [4000, 40000, 4],
  Storage: [30000, 90000, 3],
  Decor: [3000, 20000, 5],
  Ottoman: [15000, 45000, 2],
};

const NAME_PREFIX = [
  "Eugene", "Nivra", "Akito", "Jake Modular", "Moris", "Casper", "Rutvi",
  "Eloise", "Miller", "Haden", "Haven", "Meraki", "Nelson", "Aarohi",
  "Kobbler", "Kwan", "Sira", "Dahlia", "Adonis", "Martin", "Annika",
  "Bryant", "Hektor", "Magnus", "Malibu", "Foster", "Paulo", "Aion",
  "Moscow", "Kaayal", "Ebba", "Adorn",
];

const TYPE_SUFFIX: Record<string, string[]> = {
  Custom: ["Custom Build", "Bespoke Unit", "Made-to-Order Piece"],
  "Accent | Lounge Chairs": ["Lounge Chair", "Accent Chair", "Single Seater", "Wingback Chair"],
  sofa: ["Three Seater Sofa", "Four Seater Sofa", "Two Seater", "Sectional Sofa", "Diwan"],
  "Dining Chairs": ["Dining Chair", "Noir Dining Chair"],
  Console: ["Console", "Buffet Console", "Media Console"],
  "Bed Cot": ["Bed Cot", "Four Poster Bed", "Upholstered Bed Cot"],
  "Coffee Table": ["Coffee Table", "Round Coffee Table"],
  tables: ["Table", "Work Table"],
  "End Tables": ["End Table", "Side Table"],
  "Corner Sofa": ["Corner Sofa", "L-Shaped Sofa"],
  "Bed side Table": ["Bedside Table", "Nightstand"],
  Lightings: ["Floor Lamp", "Pendant Light", "Table Lamp"],
  Benches: ["Bench", "Storage Bench"],
  "Shoe Racks": ["Shoe Rack", "Shoe Cabinet"],
  "Clearance Sales": ["Clearance Chair", "Clearance Table"],
  Storage: ["Storage Cabinet", "Wardrobe"],
  Decor: ["Vase", "Wall Art", "Planter"],
  Ottoman: ["Ottoman", "Pouffe"],
};

const FINISH = ["Cashmere Art", "Vintage Light", "Golden Teak", "Noir", "Eastwood Tan", "Marcel Glacier", "Pallio Ecru", "Charlotte 500"];

export function productName(type: string, rand: () => number): string {
  const pre = NAME_PREFIX[Math.floor(rand() * NAME_PREFIX.length)];
  const suf = (TYPE_SUFFIX[type] ?? ["Piece"]);
  const s = suf[Math.floor(rand() * suf.length)];
  if (rand() < 0.35) {
    const f = FINISH[Math.floor(rand() * FINISH.length)];
    return `${pre} ${s} - ${f}`;
  }
  return `${pre} ${s}`;
}

export const FABRICS = ["Boucle", "Velvet", "Linen", "Leatherette", "Cotton Blend", "Chenille"];
export const POLISH = ["Matte", "Glossy", "Natural Oil", "Walnut", "Teak"];
export const PAYMENT_TYPES = ["Prepaid", "COD", "Razorpay", "Bank Transfer", "EMI"];
export const STATUSES_WEIGHTED: [string, number][] = [
  ["Delivered", 46],
  ["Dispatched", 22],
  ["Processing", 20],
  ["Cancelled", 7],
  ["Returned", 5],
];

// Business / repeat customers that show up in VIP rankings.
export const BUSINESS_CUSTOMERS = [
  "PADAM INTERIORS", "KEF Hospitality - Round Dome Furniture", "SpaceMatrix Roll",
  "SpaceMatrix EPAM", "Takira Atelier", "Meridian Platform", "Studio Verde",
];

export const FIRST_NAMES = [
  "Bobu", "Mohit", "Avdhedh", "Saksham", "Hemant", "Uday", "Farah", "Jyothi",
  "Rajeev", "Kartick", "Amala", "Aarav", "Diya", "Kabir", "Ananya", "Vivaan",
  "Ishaan", "Myra", "Reyansh", "Aadhya", "Sara", "Arjun", "Neha", "Rohan",
  "Priya", "Karan", "Sneha", "Manish", "Pooja", "Rahul", "Divya", "Nikhil",
];
export const LAST_NAMES = [
  "George", "Bakshi", "Tanwar", "Mahajan", "Ghorpade", "Abdulla", "Reddy",
  "Lalwani", "Jena", "Aiana", "Nair", "Menon", "Sharma", "Kapoor", "Iyer",
  "Rao", "Pillai", "Shetty", "Bhat", "Kulkarni", "Desai", "Chopra", "Malhotra",
];
