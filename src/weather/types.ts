export type UnitsSystem = "METRIC" | "IMPERIAL";

export interface WeatherText {
  text: string;
  languageCode: string;
}

export interface WeatherCondition {
  iconBaseUri: string;
  description: WeatherText;
  type: string;
}

export interface TemperatureValue {
  degrees: number;
  unit: string;
}

export interface ProbabilityValue {
  percent: number;
  type: string;
}

export interface QuantifiedValue {
  quantity: number;
  unit: string;
}

export interface WindDirection {
  degrees: number;
  cardinal: string;
}

export interface WindSpeed {
  value: number;
  unit: string;
}

export interface CurrentConditionsResponse {
  currentTime: string;
  timeZone: {
    id: string;
  };
  isDaytime: boolean;
  weatherCondition: WeatherCondition;
  temperature: TemperatureValue;
  feelsLikeTemperature?: TemperatureValue;
  dewPoint?: TemperatureValue;
  heatIndex?: TemperatureValue;
  windChill?: TemperatureValue;
  relativeHumidity?: number;
  uvIndex?: number;
  precipitation?: {
    probability?: ProbabilityValue;
    qpf?: QuantifiedValue;
  };
  thunderstormProbability?: number;
  airPressure?: {
    meanSeaLevelMillibars: number;
  };
  wind?: {
    direction?: WindDirection;
    speed?: WindSpeed;
    gust?: WindSpeed;
  };
  visibility?: {
    distance: number;
    unit: string;
  };
  cloudCover?: number;
  currentConditionsHistory?: {
    temperatureChange?: TemperatureValue;
    maxTemperature?: TemperatureValue;
    minTemperature?: TemperatureValue;
    qpf?: QuantifiedValue;
  };
}
