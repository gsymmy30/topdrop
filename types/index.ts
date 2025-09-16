export interface ListItem {
    rank: number;
    name: string;
    aliases: string[];
  }
  
  export interface Snapshot {
    id: string;
    category: string;
    items: ListItem[];
    createdAt: Date;
  }
  
  export interface GuessResult {
    found: boolean;
    item?: ListItem;
    points: number;
    exactMatch: boolean;
  }