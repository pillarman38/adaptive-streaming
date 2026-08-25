-- Demo videos scanned from G:/Demo videos

CREATE TABLE IF NOT EXISTS demoVideo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    fileName VARCHAR(500) NOT NULL,
    filePath VARCHAR(1000) NOT NULL,
    duration DECIMAL(10, 2) DEFAULT 0,
    resolution VARCHAR(50),
    channels INT,
    audio VARCHAR(100),
    dolbyVision BOOLEAN DEFAULT FALSE,
    thumbnailPath VARCHAR(1000),
    seekTime DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_title (title),
    INDEX idx_fileName (fileName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
