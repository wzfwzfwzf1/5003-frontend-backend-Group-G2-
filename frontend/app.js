class AirRouteAdvisor {
    constructor() {
        this.baseUrl = 'http://localhost:3000/api';
        this.destinations = [];
        this.init();
    }

    async init() {
        try {
            await this.loadDestinations();
            await this.loadStats();
            this.setupEventListeners();
            await this.loadPopularDestinations();
        } catch (error) {
            console.error('Initialization failed:', error);
            this.showError('System initialization failed. Please check backend service.');
        }
    }

    async loadDestinations() {
        try {
            const response = await fetch(`${this.baseUrl}/destinations`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            this.destinations = await response.json();
            
            const select = document.getElementById('destination');
            select.innerHTML = '<option value="">Select destination</option>';
            
            this.destinations.forEach(dest => {
                const option = document.createElement('option');
                option.value = dest.code;
                option.textContent = `${dest.city} - ${dest.name}`;
                select.appendChild(option);
            });
            
            console.log(`Loaded ${this.destinations.length} destinations`);
        } catch (error) {
            console.error('Failed to load destinations:', error);
            // Use mock data as fallback
            this.useMockDestinations();
        }
    }

    async loadPopularDestinations() {
        try {
            const response = await fetch(`${this.baseUrl}/popular-destinations`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const popularDestinations = await response.json();
            
            // Display popular destinations
            this.displayPopularDestinations(popularDestinations.slice(0, 5));
        } catch (error) {
            console.error('Failed to load popular destinations:', error);
        }
    }

    displayPopularDestinations(destinations) {
        // Remove old recommendations
        const oldContainer = document.querySelector('.popular-destinations');
        if (oldContainer) oldContainer.remove();
        
        const container = document.createElement('div');
        container.className = 'popular-destinations';
        container.innerHTML = `
            <h4>Popular Destinations</h4>
            <div class="popular-grid">
                ${destinations.map(dest => `
                    <div class="popular-card" data-code="${dest.code}">
                        <div class="popular-city">${dest.city}</div>
                        <div class="popular-airport" title="${dest.airport_name}">${dest.airport_name}</div>
                        <div class="popular-stats">
                            <span><i>✈️</i> ${dest.flight_count}</span>
                            <span><i>🏢</i> ${dest.airline_count}</span>
                        </div>
                        <div class="popular-score">Score: ${dest.composite_score.toFixed(1)}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        const controlPanel = document.querySelector('.control-panel');
        controlPanel.appendChild(container);
        
        // Add click events
        container.querySelectorAll('.popular-card').forEach(card => {
            card.addEventListener('click', () => {
                const code = card.dataset.code;
                this.selectDestination(code);
            });
        });
    }

    selectDestination(code) {
        document.getElementById('destination').value = code;
        this.searchRoutes();
    }

    // Fallback mock data
    useMockDestinations() {
        const mockDestinations = [
            { code: 'HND', name: 'Tokyo Haneda Airport', city: 'Tokyo' },
            { code: 'KIX', name: 'Osaka Kansai Airport', city: 'Osaka' },
            { code: 'TPE', name: 'Taiwan Taoyuan Airport', city: 'Taipei' },
            { code: 'OKA', name: 'Naha Airport', city: 'Okinawa' },
            { code: 'ICN', name: 'Incheon International Airport', city: 'Seoul' },
            { code: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok' },
            { code: 'SIN', name: 'Changi Airport', city: 'Singapore' },
            { code: 'KUL', name: 'Kuala Lumpur Airport', city: 'Kuala Lumpur' },
            { code: 'MNL', name: 'Ninoy Aquino Airport', city: 'Manila' },
            { code: 'SGN', name: 'Tan Son Nhat Airport', city: 'Ho Chi Minh' }
        ];
        
        const select = document.getElementById('destination');
        select.innerHTML = '<option value="">Select destination</option>';
        
        mockDestinations.forEach(dest => {
            const option = document.createElement('option');
            option.value = dest.code;
            option.textContent = `${dest.city} - ${dest.name}`;
            select.appendChild(option);
        });
        
        console.log('Using mock destination data');
    }

    async loadStats() {
        try {
            const response = await fetch(`${this.baseUrl}/stats`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const stats = await response.json();
            
            const statCards = document.querySelectorAll('.stat-card');
            statCards[0].querySelector('.stat-value').textContent = stats.totalRoutes;
            statCards[1].querySelector('.stat-value').textContent = stats.avgSafetyScore.toFixed(1);
            statCards[2].querySelector('.stat-value').textContent = stats.avgComfortScore.toFixed(1);
            statCards[3].querySelector('.stat-value').textContent = stats.avgCompositeScore.toFixed(1);
            
            // Add more stats if available
            if (statCards[4]) {
                statCards[4].querySelector('.stat-value').textContent = `${stats.onTimeRate}%`;
            }
        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
    }

    setupEventListeners() {
        document.getElementById('search-btn').addEventListener('click', () => this.searchRoutes());
        document.getElementById('reset-btn').addEventListener('click', () => this.reset());
        
        // Search on Enter key
        document.getElementById('destination').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchRoutes();
        });
        
        // Quick search buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-search')) {
                const code = e.target.dataset.code;
                this.selectDestination(code);
            }
        });
    }

    async searchRoutes() {
        const destination = document.getElementById('destination').value;
        const month = document.getElementById('month').value;
        const sort = document.getElementById('sort').value;
        
        if (!destination) {
            alert('Please select a destination');
            return;
        }
        
        this.showLoading(true);
        
        try {
            const params = new URLSearchParams();
            if (destination) params.append('destination', destination);
            if (month) params.append('month', month);
            if (sort) params.append('sort', sort);
            params.append('limit', 12);
            
            const response = await fetch(`${this.baseUrl}/routes?${params}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const routes = await response.json();
            
            this.displayResults(routes);
            this.createCharts(routes);
        } catch (error) {
            console.error('Route search failed:', error);
            this.showError('Search failed. Please check network connection and backend service.');
        } finally {
            this.showLoading(false);
        }
    }

    displayResults(routes) {
        const resultsGrid = document.getElementById('results');
        
        if (routes.length === 0) {
            resultsGrid.innerHTML = `
                <div class="empty-state">
                    <p>📭 No routes found matching criteria</p>
                    <p class="hint">Try selecting a different destination or month</p>
                </div>
            `;
            return;
        }
        
        resultsGrid.innerHTML = routes.map((route, index) => {
            // Set color based on score
            const getScoreColor = (score) => {
                if (score >= 90) return 'score-excellent';
                if (score >= 80) return 'score-good';
                return 'score-average';
            };
            
            return `
                <div class="route-card" data-index="${index}">
                    <div class="route-header">
                        <div class="airline-name">${route.airline_name || route.airline_name_zh}</div>
                        <span class="airline-type ${route.airline_type === 'full_service' ? 'full-service' : 'low-cost'}">
                            ${route.airline_type === 'full_service' ? 'Full Service' : 'Low Cost'}
                        </span>
                    </div>
                    <div class="destination">
                        ${route.city_name || route.city_zh} - ${route.airport_name}
                    </div>
                    <div class="scores">
                        <div class="score-item">
                            <span class="score-value ${getScoreColor(route.composite_score)}">${route.composite_score.toFixed(1)}</span>
                            <span class="score-label">Composite Score</span>
                        </div>
                        <div class="score-item">
                            <span class="score-value ${getScoreColor(route.safety_score)}">${route.safety_score.toFixed(1)}</span>
                            <span class="score-label">Safety Score</span>
                        </div>
                        <div class="score-item">
                            <span class="score-value ${getScoreColor(route.comfort_score)}">${route.comfort_score.toFixed(1)}</span>
                            <span class="score-label">Comfort Score</span>
                        </div>
                    </div>
                    <div class="route-meta">
                        <span>✈️ ${route.flight_count || 0} flights</span>
                        <span>📅 ${route.daily_avg_flights ? route.daily_avg_flights.toFixed(1) : 0} flights/day</span>
                    </div>
                    <button class="btn-details" onclick="app.showRouteDetails('${route.airline_code}', '${route.destination_code}')">
                        View Details
                    </button>
                </div>
            `;
        }).join('');
    }

    createCharts(routes) {
        // Safety score chart
        this.createBarChart('safety-chart', routes, 'safety_score', 'Safety Score');
        
        // Comfort score chart
        this.createBarChart('comfort-chart', routes, 'comfort_score', 'Comfort Score');
    }

    createBarChart(chartId, routes, key, label) {
        const chart = document.getElementById(chartId);
        chart.innerHTML = '';
        
        // Limit display count
        const displayRoutes = routes.slice(0, 8);
        const maxValue = Math.max(...displayRoutes.map(r => r[key]), 100);
        
        displayRoutes.forEach(route => {
            const value = route[key];
            const percentage = (value / maxValue) * 100;
            const airlineName = (route.airline_name || route.airline_name_zh || '').substring(0, 10) + 
                ((route.airline_name || route.airline_name_zh || '').length > 10 ? '...' : '');
            
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.cssText = `
                --percentage: ${percentage}%;
                background: linear-gradient(to right, #667eea var(--percentage), #e1e8ed var(--percentage));
            `;
            
            bar.innerHTML = `
                <span class="bar-label">${airlineName}</span>
                <span class="bar-value">${value.toFixed(1)}</span>
            `;
            
            // Add click event
            bar.addEventListener('click', () => {
                this.showRouteDetails(route.airline_code, route.destination_code);
            });
            
            chart.appendChild(bar);
        });
    }

    async showRouteDetails(airlineCode, destinationCode) {
        try {
            const response = await fetch(
                `${this.baseUrl}/routes/${airlineCode}/${destinationCode}`
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const details = await response.json();
            
            // Create detail modal
            this.showDetailModal(details);
        } catch (error) {
            console.error('Failed to load route details:', error);
            alert('Unable to load route details');
        }
    }

    showDetailModal(details) {
        // Remove old modal
        const oldModal = document.getElementById('detail-modal');
        if (oldModal) oldModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'detail-modal';
        modal.className = 'modal';
        
        const { route, airline, monthlyData, avgDelay, onTimeRate, weatherData, airport } = details;
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${airline.airline_name_en || airline.airline_name_zh || route.airline_name} → ${route.airport_name}</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="detail-grid">
                        <div class="detail-section">
                            <h3>📊 Route Information</h3>
                            <p><strong>Airline:</strong> ${airline.airline_name_en || airline.airline_name_zh || route.airline_name}</p>
                            <p><strong>Destination:</strong> ${route.city_name || route.city_zh} - ${route.airport_name}</p>
                            <p><strong>Airline Type:</strong> ${route.airline_type === 'full_service' ? 'Full Service' : 'Low Cost'}</p>
                            <p><strong>Total Flights:</strong> ${route.flight_count} flights</p>
                            <p><strong>Daily Average:</strong> ${route.daily_avg_flights.toFixed(1)} flights/day</p>
                        </div>
                        
                        <div class="detail-section">
                            <h3>⭐ Score Details</h3>
                            <p><strong>Composite Score:</strong> ${route.composite_score.toFixed(1)}</p>
                            <p><strong>Safety Score:</strong> ${route.safety_score.toFixed(1)}</p>
                            <p><strong>Comfort Score:</strong> ${route.comfort_score.toFixed(1)}</p>
                            <p><strong>On-Time Rate:</strong> ${onTimeRate}%</p>
                            <p><strong>Average Delay:</strong> ${avgDelay.toFixed(1)} minutes</p>
                        </div>
                        
                        ${weatherData ? `
                        <div class="detail-section">
                            <h3>🌤️ Weather Information</h3>
                            <p><strong>Weather:</strong> ${weatherData.weather_desc}</p>
                            <p><strong>Temperature:</strong> ${weatherData.avg_temp}°C</p>
                            <p><strong>Precipitation:</strong> ${weatherData.precipitation}mm</p>
                            <p><strong>Wind Speed:</strong> ${weatherData.wind_speed} km/h</p>
                            <p><strong>Risk Level:</strong> ${weatherData.risk_level}</p>
                        </div>
                        ` : ''}
                    </div>
                    
                    ${monthlyData && monthlyData.length > 0 ? `
                    <div class="detail-section">
                        <h3>📈 Monthly Score Trend</h3>
                        <div class="monthly-trend">
                            ${monthlyData.map(month => `
                                <div class="month-item">
                                    <div class="month-name">${month.month}</div>
                                    <div class="month-score">${month.composite_score.toFixed(1)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add events
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
        });
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        loading.style.display = show ? 'block' : 'none';
    }

    showError(message) {
        const resultsGrid = document.getElementById('results');
        resultsGrid.innerHTML = `
            <div class="empty-state error">
                <p>❌ ${message}</p>
                <button class="btn-primary" onclick="location.reload()">Refresh Page</button>
            </div>
        `;
    }

    reset() {
        document.getElementById('destination').value = '';
        document.getElementById('month').value = '';
        document.getElementById('sort').value = 'composite_score';
        
        document.getElementById('results').innerHTML = `
            <div class="empty-state">
                <p>Please select filters and click "Search Routes" button</p>
            </div>
        `;
        
        document.getElementById('safety-chart').innerHTML = '';
        document.getElementById('comfort-chart').innerHTML = '';
    }
}

// Initialize application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new AirRouteAdvisor();
});