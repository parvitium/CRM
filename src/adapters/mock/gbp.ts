import type { GbpAdapter, GbpProfileView } from "../types";

const MOCK: Record<string, GbpProfileView> = {
  ChIJmocksummit: {
    placeId: "ChIJmocksummit",
    name: "Summit Ridge Roofing LLC",
    address: "100 Mock Ridge Rd, Tooele, UT 84074",
    phone: "435-555-0101",
    mapsUrl: "https://maps.example/summit",
    rating: 4.8,
    reviewCount: 42,
  },
  ChIJmockcopper: {
    placeId: "ChIJmockcopper",
    name: "Copper Peak Plumbing LLC",
    address: "50 Mock Copper St, Grantsville, UT 84029",
    phone: "435-555-0102",
    mapsUrl: "https://maps.example/copper",
    rating: 4.6,
    reviewCount: 19,
  },
  ChIJmocklake: {
    placeId: "ChIJmocklake",
    name: "Lakeview Electric Co.",
    address: "12 Mock Lake Dr, Stansbury Park, UT 84074",
    phone: "435-555-0103",
    mapsUrl: "https://maps.example/lakeview",
    rating: 5.0,
    reviewCount: 8,
  },
};

export class MockGbpAdapter implements GbpAdapter {
  async fetchProfile(placeId: string): Promise<GbpProfileView | null> {
    return MOCK[placeId] ?? null;
  }
}
