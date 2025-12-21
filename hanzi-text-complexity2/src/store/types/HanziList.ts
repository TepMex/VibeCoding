export enum HanziListType {
  Inclusive = "inclusive",
  Exclusive = "exclusive",
}

export interface HanziList {
  name: string;
  type: HanziListType;
  data: string;
  color?: string;
}

