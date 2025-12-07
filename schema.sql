
CREATE DATABASE IF NOT EXISTS airroute_advisor;
USE airroute_advisor;

CREATE TABLE airlines (
    airline_code VARCHAR(5) PRIMARY KEY,
    airline_name_en VARCHAR(50),
    airline_name_zh VARCHAR(50),
    airline_type ENUM('full_service', 'low_cost')
);

CREATE TABLE airports (
    airport_code CHAR(3) PRIMARY KEY,
    airport_name_en VARCHAR(100),
    airport_name_zh VARCHAR(50),
    city_zh VARCHAR(20)
);

CREATE TABLE flights (
    id INT AUTO_INCREMENT PRIMARY KEY,
    flight_date DATE NOT NULL,
    flight_number VARCHAR(10),
    airline_code VARCHAR(5),
    destination_code CHAR(3),
    destination_name VARCHAR(50),
    scheduled_time TIME,
    actual_time TIME,
    flight_status VARCHAR(20),
    departure_hour TINYINT,
    day_of_week TINYINT,
    is_weekend TINYINT,
    delay_minutes INT,
    terminal VARCHAR(10),
    gate VARCHAR(10),
    INDEX idx_date_dest (flight_date, destination_code),
    INDEX idx_airline (airline_code),
    FOREIGN KEY (airline_code) REFERENCES airlines(airline_code),
    FOREIGN KEY (destination_code) REFERENCES airports(airport_code)
);

CREATE TABLE safety_ratings (
    airline_code VARCHAR(5) PRIMARY KEY,
    safety_stars TINYINT,
    product_stars TINYINT,
    experience_rating DECIMAL(3,1),
    safety_score DECIMAL(5,1),
    product_score DECIMAL(5,1),
    FOREIGN KEY (airline_code) REFERENCES airlines(airline_code)
);

CREATE TABLE comfort_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    airline_code VARCHAR(5),
    overall_rating DECIMAL(3,1),
    seat_comfort DECIMAL(2,1),
    staff_service DECIMAL(2,1),
    food_rating DECIMAL(2,1),
    entertainment DECIMAL(2,1),
    ground_service DECIMAL(2,1),
    wifi_rating DECIMAL(2,1),
    value_rating DECIMAL(2,1),
    cabin_class ENUM('Economy','Premium Economy','Business','First','Unknown'),
    traveller_type VARCHAR(20),
    aircraft_type VARCHAR(20),
    route VARCHAR(100),
    review_date DATE,
    date_flown DATE,
    is_verified TINYINT,
    is_recommended TINYINT,
    review_title VARCHAR(100),
    review_text TEXT,
    INDEX idx_airline (airline_code),
    FOREIGN KEY (airline_code) REFERENCES airlines(airline_code)
);

CREATE TABLE weather (
    id INT AUTO_INCREMENT PRIMARY KEY,
    airport_code CHAR(3),
    weather_date DATE,
    avg_temp DECIMAL(4,1),
    max_temp DECIMAL(4,1),
    min_temp DECIMAL(4,1),
    precipitation DECIMAL(5,1),
    wind_speed INT,
    wind_gust INT,
    visibility INT,
    weather_code INT,
    weather_desc VARCHAR(20),
    risk_score_raw DECIMAL(3,2),
    safety_risk TINYINT,
    comfort_risk TINYINT,
    risk_level ENUM('Low','Medium','High'),
    UNIQUE KEY uk_airport_date (airport_code, weather_date),
    FOREIGN KEY (airport_code) REFERENCES airports(airport_code)
);

CREATE TABLE airline_summary (
    airline_code VARCHAR(5) PRIMARY KEY,
    airline_name_zh VARCHAR(50),
    airline_type ENUM('full_service', 'low_cost'),
    safety_stars TINYINT,
    safety_score DECIMAL(5,1),
    product_score DECIMAL(5,1),
    experience_rating DECIMAL(3,1),
    review_count INT,
    avg_overall DECIMAL(3,1),
    avg_seat DECIMAL(2,1),
    avg_staff DECIMAL(2,1),
    avg_food DECIMAL(2,1),
    avg_entertainment DECIMAL(2,1),
    avg_value DECIMAL(2,1),
    recommend_rate DECIMAL(5,1),
    comfort_score DECIMAL(5,1),
    flight_count INT,
    destinations VARCHAR(50),
    composite_score DECIMAL(5,1),
    INDEX idx_composite (composite_score DESC),
    INDEX idx_safety (safety_score DESC),
    INDEX idx_comfort (comfort_score DESC),
    FOREIGN KEY (airline_code) REFERENCES airlines(airline_code)
);

CREATE TABLE route_summary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    airline_code VARCHAR(5),
    airline_name_zh VARCHAR(50),
    airline_type ENUM('full_service', 'low_cost'),
    destination_code CHAR(3),
    destination_name VARCHAR(50),
    city_zh VARCHAR(20),
    flight_count INT,
    daily_avg_flights DECIMAL(4,1),
    earliest_departure TIME,
    latest_departure TIME,
    safety_score DECIMAL(5,1),
    comfort_score DECIMAL(5,1),
    weather_safety_score DECIMAL(5,1),
    weather_comfort_score DECIMAL(5,1),
    composite_score DECIMAL(5,1),
    UNIQUE KEY uk_route (airline_code, destination_code),
    INDEX idx_dest_composite (destination_code, composite_score DESC),
    FOREIGN KEY (airline_code) REFERENCES airlines(airline_code),
    FOREIGN KEY (destination_code) REFERENCES airports(airport_code)
);

CREATE TABLE route_monthly_summary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    airline_code VARCHAR(5),
    airline_name_zh VARCHAR(50),
    airline_type ENUM('full_service', 'low_cost'),
    destination_code CHAR(3),
    destination_name VARCHAR(50),
    city_zh VARCHAR(20),
    month TINYINT,
    flight_count INT,
    daily_avg_flights DECIMAL(4,1),
    earliest_departure TIME,
    latest_departure TIME,
    safety_score DECIMAL(5,1),
    comfort_score DECIMAL(5,1),
    weather_safety_score DECIMAL(5,1),
    weather_comfort_score DECIMAL(5,1),
    composite_score DECIMAL(5,1),
    UNIQUE KEY uk_route_month (airline_code, destination_code, month),
    INDEX idx_dest_month_composite (destination_code, month, composite_score DESC),
    INDEX idx_month (month),
    FOREIGN KEY (airline_code) REFERENCES airlines(airline_code),
    FOREIGN KEY (destination_code) REFERENCES airports(airport_code)
);
