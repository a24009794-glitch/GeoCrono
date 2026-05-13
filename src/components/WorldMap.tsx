import React, { useMemo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from 'react-simple-maps';
import { mapMapping } from '../data/mapMapping';
import { micronations } from '../data/micronations';
import { countries } from '../data/countries';

const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

interface WorldMapProps {
  foundCountries: string[];
  region: string;
  mapStyle?: 'light' | 'dark';
}

const REGION_CONFIGS: Record<string, { center: [number, number], zoom: number }> = {
  "Mundo": { center: [0, 30], zoom: 1 },
  "América": { center: [-80, -5], zoom: 1.3 },
  "Europa": { center: [15, 52], zoom: 3.5 },
  "África": { center: [18, 0], zoom: 2.1 },
  "Asia": { center: [90, 35], zoom: 1.8 },
  "Oceanía": { center: [140, -20], zoom: 3 }
};

export const WorldMap: React.FC<WorldMapProps> = ({ foundCountries, region, mapStyle = 'light' }) => {
  // Convert found Spanish names to TopoJSON English names
  const foundTopoNames = useMemo(() => {
    return foundCountries.map(c => mapMapping[c]).filter(Boolean);
  }, [foundCountries]);

  const relevantMicronations = useMemo(() => {
    return micronations.filter(micro => {
      const countryObj = countries.find(c => c.name === micro.name);
      if (!countryObj) return false;
      if (region === "Mundo") return true;
      return countryObj.regions.includes(region);
    });
  }, [region]);

  const mapConfig = REGION_CONFIGS[region] || REGION_CONFIGS["Mundo"];

  const isDark = mapStyle === 'dark';
  const bgColor = isDark ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-transparent";
  const defaultFill = isDark ? "#334155" : "#e2e8f0";
  const hoverFill = isDark ? "#475569" : "#cbd5e1";
  const strokeColor = isDark ? "#1e293b" : "#ffffff";
  const foundFill = isDark ? "#34d399" : "#10b981";
  const foundHoverFill = isDark ? "#10b981" : "#059669";

  return (
    <div className={`w-full h-full ${bgColor} rounded-xl overflow-hidden flex items-center justify-center relative transition-colors`}>
      <ComposableMap 
        projection="geoMercator" 
        projectionConfig={{ scale: 120 }}
        width={800}
        height={400}
        className="w-full h-full object-cover"
      >
        <ZoomableGroup 
          center={mapConfig.center} 
          zoom={mapConfig.zoom} 
          minZoom={1} 
          maxZoom={8}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const isFound = foundTopoNames.includes(geo.properties.name);
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={isFound ? foundFill : defaultFill}
                    stroke={strokeColor}
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none", transition: "all 250ms" },
                      hover: { outline: "none", fill: isFound ? foundHoverFill : hoverFill, transition: "all 250ms" },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>

          {/* Render micronations as markers */}
           {relevantMicronations.map(({ name, coordinates }) => {
            const isFound = foundCountries.includes(name);
            return (
              <Marker key={name} coordinates={coordinates}>
                <circle 
                  r={isFound ? 2 : 1.2} 
                  fill={isFound ? foundFill : defaultFill} 
                  stroke={strokeColor} 
                  strokeWidth={0.5} 
                  className="transition-all duration-300 pointer-events-none"
                />
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
};

