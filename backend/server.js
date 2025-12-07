const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

// Enable CORS
app.use(cors());
app.use(express.json());

// Data directory
const dataDir = path.join(__dirname, 'data');

// Load JSON data files
async function loadData(fileName) {
    try {
        const filePath = path.join(dataDir, fileName);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Failed to load ${fileName}:`, error);
        return [];
    }
}

// 1. Get all destinations (deduplicated)
app.get('/api/destinations', async (req, res) => {
    try {
        const airports = await loadData('airports.json');
        const routes = await loadData('route_summary.json');
        
        // Get all airport codes used in routes
        const activeAirportCodes = [...new Set(routes.map(route => route.destination_code))];
        
        // Filter and deduplicate from airport data
        const seen = new Set();
        const destinations = [];
        
        airports.forEach(airport => {
            if (activeAirportCodes.includes(airport.airport_code) && !seen.has(airport.airport_code)) {
                seen.add(airport.airport_code);
                destinations.push({
                    code: airport.airport_code,
                    name: airport.airport_name_en || airport.airport_name_zh,
                    city: airport.city_zh || airport.airport_code
                });
            }
        });
        
        // Sort by city name
        destinations.sort((a, b) => a.name.localeCompare(b.name));
        
        res.json(destinations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Get airline list
app.get('/api/airlines', async (req, res) => {
    try {
        const airlines = await loadData('airline_summary.json');
        // Use English names if available
        const airlinesWithNames = airlines.map(airline => ({
            ...airline,
            airline_name: airline.airline_name_en || airline.airline_name_zh
        }));
        res.json(airlinesWithNames);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Get popular destinations (most flights)
app.get('/api/popular-destinations', async (req, res) => {
    try {
        const routes = await loadData('route_summary.json');
        const airports = await loadData('airports.json');
        
        // Group by destination and count flights
        const destinationStats = {};
        
        routes.forEach(route => {
            const destCode = route.destination_code;
            if (!destinationStats[destCode]) {
                destinationStats[destCode] = {
                    code: destCode,
                    flight_count: 0,
                    airline_count: 0,
                    avg_safety_score: 0,
                    avg_comfort_score: 0,
                    routes: []
                };
            }
            
            destinationStats[destCode].flight_count += route.flight_count;
            destinationStats[destCode].airline_count += 1;
            destinationStats[destCode].avg_safety_score += route.safety_score;
            destinationStats[destCode].avg_comfort_score += route.comfort_score;
            destinationStats[destCode].routes.push(route);
        });
        
        // Calculate average scores
        Object.values(destinationStats).forEach(stats => {
            stats.avg_safety_score = stats.avg_safety_score / stats.routes.length;
            stats.avg_comfort_score = stats.avg_comfort_score / stats.routes.length;
            stats.composite_score = (stats.avg_safety_score * 0.6 + stats.avg_comfort_score * 0.4);
        });
        
        // Convert to array and sort by flight count
        let destinations = Object.values(destinationStats)
            .sort((a, b) => b.flight_count - a.flight_count);
        
        // Add airport information
        destinations = destinations.map(dest => {
            const airport = airports.find(a => a.airport_code === dest.code);
            return {
                ...dest,
                airport_name: airport ? (airport.airport_name_en || airport.airport_name_zh) : dest.code,
                city: airport ? airport.city_zh || dest.code : dest.code
            };
        });
        
        res.json(destinations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Get route data (improved)
app.get('/api/routes', async (req, res) => {
    try {
        const { destination, month, sort = 'composite_score', limit = 10 } = req.query;
        let routes = await loadData('route_summary.json');
        const airports = await loadData('airports.json');
        
        // If destination is city name, find corresponding airport code
        let destinationCode = destination;
        if (destination && !destination.match(/^[A-Z]{3}$/)) {
            // Might be city name, find corresponding airport
            const airport = airports.find(a => 
                a.city_zh === destination || 
                a.airport_name_en.toLowerCase().includes(destination.toLowerCase()) ||
                a.airport_name_zh.includes(destination)
            );
            if (airport) {
                destinationCode = airport.airport_code;
            }
        }
        
        // Filter by destination
        if (destinationCode) {
            routes = routes.filter(route => 
                route.destination_code === destinationCode
            );
        }
        
        // If month specified, merge monthly data
        if (month) {
            const monthlyRoutes = await loadData('route_monthly_summary.json');
            const monthlyData = monthlyRoutes.filter(route => 
                route.month == month && 
                (!destinationCode || route.destination_code === destinationCode)
            );
            
            // Merge data
            const monthlyMap = new Map();
            monthlyData.forEach(mr => {
                const key = `${mr.airline_code}-${mr.destination_code}`;
                monthlyMap.set(key, mr);
            });
            
            routes = routes.map(route => {
                const key = `${route.airline_code}-${route.destination_code}`;
                const monthly = monthlyMap.get(key);
                return monthly ? { ...route, ...monthly } : route;
            });
        }
        
        // Sorting
        if (sort === 'safety_score') {
            routes.sort((a, b) => b.safety_score - a.safety_score);
        } else if (sort === 'comfort_score') {
            routes.sort((a, b) => b.comfort_score - a.comfort_score);
        } else if (sort === 'flight_count') {
            routes.sort((a, b) => b.flight_count - a.flight_count);
        } else {
            routes.sort((a, b) => b.composite_score - a.composite_score);
        }
        
        // Limit results
        routes = routes.slice(0, parseInt(limit));
        
        // Add airport city information
        const airportMap = new Map();
        airports.forEach(a => airportMap.set(a.airport_code, a));
        
        routes = routes.map(route => ({
            ...route,
            city_name: airportMap.get(route.destination_code)?.city_zh || route.city_zh,
            airport_name: airportMap.get(route.destination_code)?.airport_name_en || 
                          airportMap.get(route.destination_code)?.airport_name_zh || 
                          route.destination_name,
            airline_name: route.airline_name_en || route.airline_name_zh
        }));
        
        res.json(routes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Get route details
app.get('/api/routes/:airlineCode/:destinationCode', async (req, res) => {
    try {
        const { airlineCode, destinationCode } = req.params;
        
        // Load all related data
        const routes = await loadData('route_summary.json');
        const monthlyRoutes = await loadData('route_monthly_summary.json');
        const airlines = await loadData('airline_summary.json');
        const flights = await loadData('flights.json');
        const weather = await loadData('weather.json');
        const airports = await loadData('airports.json');
        
        // Find route
        const route = routes.find(r => 
            r.airline_code === airlineCode && 
            r.destination_code === destinationCode
        );
        
        if (!route) {
            return res.status(404).json({ error: 'Route not found' });
        }
        
        // Find airline information
        const airline = airlines.find(a => a.airline_code === airlineCode);
        
        // Find monthly data
        const monthlyData = monthlyRoutes.filter(mr => 
            mr.airline_code === airlineCode && 
            mr.destination_code === destinationCode
        );
        
        // Find flight data
        const flightData = flights.filter(f => 
            f.airline_code === airlineCode && 
            f.destination_code === destinationCode
        ).slice(0, 50);
        
        // Find weather data
        const weatherData = weather.filter(w => 
            w.airport_code === destinationCode
        ).slice(0, 30);
        
        // Find airport information
        const airport = airports.find(a => a.airport_code === destinationCode);
        
        res.json({
            route: {
                ...route,
                airline_name: airline?.airline_name_en || airline?.airline_name_zh || route.airline_name_zh,
                airport_name: airport?.airport_name_en || airport?.airport_name_zh || route.destination_name
            },
            airline,
            monthlyData,
            flightData: flightData.length,
            avgDelay: flightData.length > 0 ? 
                flightData.reduce((sum, f) => sum + (f.delay_minutes || 0), 0) / flightData.length : 0,
            onTimeRate: flightData.length > 0 ? 
                (flightData.filter(f => !f.delay_minutes || f.delay_minutes <= 15).length / flightData.length * 100).toFixed(1) : 0,
            weatherData: weatherData.length > 0 ? weatherData[0] : null,
            airport
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Get statistics
app.get('/api/stats', async (req, res) => {
    try {
        const routes = await loadData('route_summary.json');
        const airlines = await loadData('airline_summary.json');
        const flights = await loadData('flights.json');
        
        // Calculate on-time rate
        const onTimeFlights = flights.filter(f => 
            !f.delay_minutes || f.delay_minutes <= 15
        ).length;
        const onTimeRate = flights.length > 0 ? 
            (onTimeFlights / flights.length * 100).toFixed(1) : 0;
        
        const stats = {
            totalRoutes: routes.length,
            totalAirlines: airlines.length,
            totalFlights: flights.length,
            avgSafetyScore: routes.reduce((sum, r) => sum + r.safety_score, 0) / routes.length,
            avgComfortScore: routes.reduce((sum, r) => sum + r.comfort_score, 0) / routes.length,
            avgCompositeScore: routes.reduce((sum, r) => sum + r.composite_score, 0) / routes.length,
            onTimeRate: parseFloat(onTimeRate)
        };
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 7. Get all months data
app.get('/api/months', async (req, res) => {
    try {
        const months = [
            { id: 1, name: "January" },
            { id: 2, name: "February" },
            { id: 3, name: "March" },
            { id: 4, name: "April" },
            { id: 5, name: "May" },
            { id: 6, name: "June" },
            { id: 7, name: "July" },
            { id: 8, name: "August" },
            { id: 9, name: "September" },
            { id: 10, name: "October" },
            { id: 11, name: "November" },
            { id: 12, name: "December" }
        ];
        res.json(months);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 8. Get airport details
app.get('/api/airports/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const airports = await loadData('airports.json');
        const airport = airports.find(a => a.airport_code === code);
        
        if (!airport) {
            return res.status(404).json({ error: 'Airport not found' });
        }
        
        // Get route information for this airport
        const routes = await loadData('route_summary.json');
        const airportRoutes = routes.filter(r => r.destination_code === code);
        
        // Get weather information
        const weather = await loadData('weather.json');
        const recentWeather = weather.filter(w => w.airport_code === code)
            .sort((a, b) => new Date(b.weather_date) - new Date(a.weather_date))
            .slice(0, 7);
        
        res.json({
            airport: {
                ...airport,
                name: airport.airport_name_en || airport.airport_name_zh,
                city: airport.city_zh || airport.airport_code
            },
            routes: airportRoutes.length,
            airlines: [...new Set(airportRoutes.map(r => r.airline_code))].length,
            recentWeather
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Backend service running at http://localhost:${PORT}`);
    console.log(`📊 Available APIs:`);
    console.log(`   GET /api/destinations - Get all destinations`);
    console.log(`   GET /api/airlines - Get airline list`);
    console.log(`   GET /api/popular-destinations - Get popular destinations`);
    console.log(`   GET /api/routes - Search routes`);
    console.log(`   GET /api/stats - Get statistics`);
    console.log(`   GET /api/months - Get month list`);
});