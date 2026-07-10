/**
 * Lat/lng for Indian cities, used to place the bubbles on the India map.
 *
 * Keys are the *canonical* city spellings that `normalizeCity()` emits — so
 * "BANGALORE" in a sheet becomes "Bengaluru" here, and there is no second alias
 * table at render time. A city absent from this table simply gets no bubble;
 * its revenue still counts toward its state's choropleth shade, and the map
 * reports how much revenue it could not place.
 *
 * Coordinates are city-centre, rounded to 4dp (~11m) — far finer than a bubble
 * on a country-scale map needs.
 */
export type CityCoord = { city: string; state: string; lat: number; lng: number };

export const CITY_COORDS: CityCoord[] = [
  // Metros
  { city: "Mumbai", state: "Maharashtra", lat: 19.076, lng: 72.8777 },
  { city: "Delhi", state: "Delhi", lat: 28.6139, lng: 77.209 },
  { city: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
  { city: "Hyderabad", state: "Telangana", lat: 17.385, lng: 78.4867 },
  { city: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707 },
  { city: "Kolkata", state: "West Bengal", lat: 22.5726, lng: 88.3639 },
  { city: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
  { city: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714 },

  // Tier-1 / state capitals
  { city: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
  { city: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
  { city: "Kanpur", state: "Uttar Pradesh", lat: 26.4499, lng: 80.3319 },
  { city: "Nagpur", state: "Maharashtra", lat: 21.1458, lng: 79.0882 },
  { city: "Indore", state: "Madhya Pradesh", lat: 22.7196, lng: 75.8577 },
  { city: "Bhopal", state: "Madhya Pradesh", lat: 23.2599, lng: 77.4126 },
  { city: "Patna", state: "Bihar", lat: 25.5941, lng: 85.1376 },
  { city: "Bhubaneswar", state: "Odisha", lat: 20.2961, lng: 85.8245 },
  { city: "Chandigarh", state: "Chandigarh", lat: 30.7333, lng: 76.7794 },
  { city: "Dehradun", state: "Uttarakhand", lat: 30.3165, lng: 78.0322 },
  { city: "Raipur", state: "Chhattisgarh", lat: 21.2514, lng: 81.6296 },
  { city: "Ranchi", state: "Jharkhand", lat: 23.3441, lng: 85.3096 },
  { city: "Guwahati", state: "Assam", lat: 26.1445, lng: 91.7362 },
  { city: "Shimla", state: "Himachal Pradesh", lat: 31.1048, lng: 77.1734 },
  { city: "Srinagar", state: "Jammu and Kashmir", lat: 34.0837, lng: 74.7973 },
  { city: "Jammu", state: "Jammu and Kashmir", lat: 32.7266, lng: 74.857 },
  { city: "Panaji", state: "Goa", lat: 15.4909, lng: 73.8278 },
  { city: "Thiruvananthapuram", state: "Kerala", lat: 8.5241, lng: 76.9366 },
  { city: "Puducherry", state: "Puducherry", lat: 11.9416, lng: 79.8083 },
  { city: "Gandhinagar", state: "Gujarat", lat: 23.2156, lng: 72.6369 },
  { city: "Agartala", state: "Tripura", lat: 23.8315, lng: 91.2868 },
  { city: "Imphal", state: "Manipur", lat: 24.817, lng: 93.9368 },
  { city: "Shillong", state: "Meghalaya", lat: 25.5788, lng: 91.8933 },
  { city: "Aizawl", state: "Mizoram", lat: 23.7271, lng: 92.7176 },
  { city: "Kohima", state: "Nagaland", lat: 25.6751, lng: 94.1086 },
  { city: "Itanagar", state: "Arunachal Pradesh", lat: 27.0844, lng: 93.6053 },
  { city: "Gangtok", state: "Sikkim", lat: 27.3314, lng: 88.6138 },
  { city: "Port Blair", state: "Andaman and Nicobar Islands", lat: 11.6234, lng: 92.7265 },

  // NCR
  { city: "Gurgaon", state: "Haryana", lat: 28.4595, lng: 77.0266 },
  { city: "Noida", state: "Uttar Pradesh", lat: 28.5355, lng: 77.391 },
  { city: "Ghaziabad", state: "Uttar Pradesh", lat: 28.6692, lng: 77.4538 },
  { city: "Faridabad", state: "Haryana", lat: 28.4089, lng: 77.3178 },

  // Maharashtra / Gujarat belt
  { city: "Thane", state: "Maharashtra", lat: 19.2183, lng: 72.9781 },
  { city: "Navi Mumbai", state: "Maharashtra", lat: 19.033, lng: 73.0297 },
  { city: "Nashik", state: "Maharashtra", lat: 19.9975, lng: 73.7898 },
  { city: "Aurangabad", state: "Maharashtra", lat: 19.8762, lng: 75.3433 },
  { city: "Solapur", state: "Maharashtra", lat: 17.6599, lng: 75.9064 },
  { city: "Kolhapur", state: "Maharashtra", lat: 16.705, lng: 74.2433 },
  { city: "Sangli", state: "Maharashtra", lat: 16.8524, lng: 74.5815 },
  { city: "Amravati", state: "Maharashtra", lat: 20.9374, lng: 77.7796 },
  { city: "Nanded", state: "Maharashtra", lat: 19.1383, lng: 77.321 },
  { city: "Surat", state: "Gujarat", lat: 21.1702, lng: 72.8311 },
  { city: "Vadodara", state: "Gujarat", lat: 22.3072, lng: 73.1812 },
  { city: "Rajkot", state: "Gujarat", lat: 22.3039, lng: 70.8022 },
  { city: "Bhavnagar", state: "Gujarat", lat: 21.7645, lng: 72.1519 },
  { city: "Jamnagar", state: "Gujarat", lat: 22.4707, lng: 70.0577 },
  { city: "Anand", state: "Gujarat", lat: 22.5645, lng: 72.9289 },
  { city: "Bharuch", state: "Gujarat", lat: 21.7051, lng: 72.9959 },
  { city: "Valsad", state: "Gujarat", lat: 20.5992, lng: 72.9342 },
  { city: "Vapi", state: "Gujarat", lat: 20.3893, lng: 72.9106 },
  // Sarigam is an industrial estate in Valsad district, not a census city.
  { city: "Sarigam", state: "Gujarat", lat: 20.3, lng: 72.93 },

  // South
  { city: "Coimbatore", state: "Tamil Nadu", lat: 11.0168, lng: 76.9558 },
  { city: "Madurai", state: "Tamil Nadu", lat: 9.9252, lng: 78.1198 },
  { city: "Tiruchirappalli", state: "Tamil Nadu", lat: 10.7905, lng: 78.7047 },
  { city: "Salem", state: "Tamil Nadu", lat: 11.6643, lng: 78.146 },
  { city: "Erode", state: "Tamil Nadu", lat: 11.341, lng: 77.7172 },
  { city: "Vellore", state: "Tamil Nadu", lat: 12.9165, lng: 79.1325 },
  { city: "Tirunelveli", state: "Tamil Nadu", lat: 8.7139, lng: 77.7567 },
  { city: "Mysore", state: "Karnataka", lat: 12.2958, lng: 76.6394 },
  { city: "Mangalore", state: "Karnataka", lat: 12.9141, lng: 74.856 },
  { city: "Hubli", state: "Karnataka", lat: 15.3647, lng: 75.124 },
  { city: "Belgaum", state: "Karnataka", lat: 15.8497, lng: 74.4977 },
  { city: "Gulbarga", state: "Karnataka", lat: 17.3297, lng: 76.8343 },
  { city: "Visakhapatnam", state: "Andhra Pradesh", lat: 17.6868, lng: 83.2185 },
  { city: "Vijayawada", state: "Andhra Pradesh", lat: 16.5062, lng: 80.648 },
  { city: "Guntur", state: "Andhra Pradesh", lat: 16.3067, lng: 80.4365 },
  { city: "Nellore", state: "Andhra Pradesh", lat: 14.4426, lng: 79.9865 },
  { city: "Warangal", state: "Telangana", lat: 17.9689, lng: 79.5941 },

  // Kerala
  { city: "Kochi", state: "Kerala", lat: 9.9312, lng: 76.2673 },
  { city: "Calicut", state: "Kerala", lat: 11.2588, lng: 75.7804 },
  { city: "Thrissur", state: "Kerala", lat: 10.5276, lng: 76.2144 },
  { city: "Kollam", state: "Kerala", lat: 8.8932, lng: 76.6141 },
  { city: "Kannur", state: "Kerala", lat: 11.8745, lng: 75.3704 },
  { city: "Alappuzha", state: "Kerala", lat: 9.4981, lng: 76.3388 },
  { city: "Palakkad", state: "Kerala", lat: 10.7867, lng: 76.6548 },
  { city: "Kottayam", state: "Kerala", lat: 9.5916, lng: 76.5222 },
  { city: "Muvattupuzha", state: "Kerala", lat: 9.9894, lng: 76.579 },

  // North / Central / East
  { city: "Varanasi", state: "Uttar Pradesh", lat: 25.3176, lng: 82.9739 },
  { city: "Agra", state: "Uttar Pradesh", lat: 27.1767, lng: 78.0081 },
  { city: "Meerut", state: "Uttar Pradesh", lat: 28.9845, lng: 77.7064 },
  { city: "Prayagraj", state: "Uttar Pradesh", lat: 25.4358, lng: 81.8463 },
  { city: "Bareilly", state: "Uttar Pradesh", lat: 28.367, lng: 79.4304 },
  { city: "Aligarh", state: "Uttar Pradesh", lat: 27.8974, lng: 78.088 },
  { city: "Moradabad", state: "Uttar Pradesh", lat: 28.8386, lng: 78.7733 },
  { city: "Gorakhpur", state: "Uttar Pradesh", lat: 26.7606, lng: 83.3732 },
  { city: "Ludhiana", state: "Punjab", lat: 30.901, lng: 75.8573 },
  { city: "Amritsar", state: "Punjab", lat: 31.634, lng: 74.8723 },
  { city: "Jalandhar", state: "Punjab", lat: 31.326, lng: 75.5762 },
  { city: "Mohali", state: "Punjab", lat: 30.7046, lng: 76.7179 },
  { city: "Panchkula", state: "Haryana", lat: 30.6942, lng: 76.8606 },
  { city: "Jodhpur", state: "Rajasthan", lat: 26.2389, lng: 73.0243 },
  { city: "Kota", state: "Rajasthan", lat: 25.2138, lng: 75.8648 },
  { city: "Ajmer", state: "Rajasthan", lat: 26.4499, lng: 74.6399 },
  { city: "Udaipur", state: "Rajasthan", lat: 24.5854, lng: 73.7125 },
  { city: "Bikaner", state: "Rajasthan", lat: 28.0229, lng: 73.3119 },
  { city: "Gwalior", state: "Madhya Pradesh", lat: 26.2183, lng: 78.1828 },
  { city: "Jabalpur", state: "Madhya Pradesh", lat: 23.1815, lng: 79.9864 },
  { city: "Ujjain", state: "Madhya Pradesh", lat: 23.1765, lng: 75.7885 },
  { city: "Bhilai", state: "Chhattisgarh", lat: 21.1938, lng: 81.3509 },
  { city: "Jamshedpur", state: "Jharkhand", lat: 22.8046, lng: 86.2029 },
  { city: "Dhanbad", state: "Jharkhand", lat: 23.7957, lng: 86.4304 },
  { city: "Gaya", state: "Bihar", lat: 24.7955, lng: 85.0002 },
  { city: "Cuttack", state: "Odisha", lat: 20.4625, lng: 85.883 },
  { city: "Rourkela", state: "Odisha", lat: 22.2604, lng: 84.8536 },
  { city: "Howrah", state: "West Bengal", lat: 22.5958, lng: 88.2636 },
  { city: "Durgapur", state: "West Bengal", lat: 23.5204, lng: 87.3119 },
  { city: "Asansol", state: "West Bengal", lat: 23.6739, lng: 86.9524 },
  { city: "Siliguri", state: "West Bengal", lat: 26.7271, lng: 88.3953 },
];
