FROM eclipse-temurin:21-jdk-jammy

# Install Node.js 20 and utilities
RUN apt-get update && \
    apt-get install -y curl unzip && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Gradle 8.12
ENV GRADLE_VERSION=8.12
RUN curl -fsSL "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" \
      -o /tmp/gradle.zip && \
    unzip /tmp/gradle.zip -d /opt/ && \
    rm /tmp/gradle.zip
ENV PATH="/opt/gradle-${GRADLE_VERSION}/bin:${PATH}"

# Persistent Gradle cache directory baked into the image
ENV GRADLE_USER_HOME=/gradle-cache
ENV GRADLE_OPTS="-Dorg.gradle.daemon=false -Dorg.gradle.jvmargs=-Xmx512m -Dfile.encoding=UTF-8"

# Pre-warm Gradle + Fabric Loom + Minecraft 1.20.4 dependencies
# This downloads all heavy artifacts once at build time so
# actual user builds take seconds instead of minutes.
COPY warmup/ /tmp/warmup/
RUN cd /tmp/warmup && \
    gradle build --no-daemon --warning-mode=none -x test || true && \
    rm -rf /tmp/warmup /tmp/warmup-*

# Install Node dependencies
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

EXPOSE 3000
CMD ["node", "server.js"]
