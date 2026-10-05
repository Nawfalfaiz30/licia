plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val liciaUrl = providers.gradleProperty("LICIA_URL").orElse("https://licia.site").get().trimEnd('/')

android {
    namespace = "com.licia.lifeos"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.licia.lifeos"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "LICIA_URL", "\"$liciaUrl\"")
        buildConfigField("String", "LICIA_HOST", "\"${java.net.URI(liciaUrl).host ?: "licia.site"}\"")
    }

    buildFeatures {
        buildConfig = true
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildTypes {
        debug {
            manifestPlaceholders["allowCleartext"] = "true"
        }
        release {
            manifestPlaceholders["allowCleartext"] = "false"
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
}
