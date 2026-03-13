package com.worldsim.server.util;

public class UtilityCurveEvaluator {

    /**
     * Evaluates a linear curve where utility increases as the value decreases.
     * Useful for needs (e.g., lower hunger value = higher need to eat).
     * 
     * @param currentValue Form 0.0 to 100.0
     * @return Score from 0.0 to 1.0 (1.0 meaning maximum priority)
     */
    public static double evaluateInverseLinearNeed(double currentValue) {
        if (currentValue <= 0.0) return 1.0;
        if (currentValue >= 100.0) return 0.0;
        return 1.0 - (currentValue / 100.0);
    }

    /**
     * Evaluates an exponential curve where urgency spikes rapidly as the value gets very low.
     * Useful for critical survival needs (e.g., starving).
     * 
     * @param currentValue From 0.0 to 100.0
     * @param steepness Controls how fast the curve spikes (e.g., 5.0)
     * @return Score from 0.0 to 1.0
     */
    public static double evaluateInverseExponentialNeed(double currentValue, double steepness) {
        if (currentValue <= 0.0) return 1.0;
        if (currentValue >= 100.0) return 0.0;
        
        // Normalize x between 0 and 1
        double x = currentValue / 100.0;
        
        // e^(-steepness * x) gives us a curve that spikes near 0
        // We normalize it roughly so that 0 -> 1 and 1 -> ~0
        double rawScore = Math.exp(-steepness * x);
        double minRaw = Math.exp(-steepness);
        double maxRaw = 1.0;
        
        return (rawScore - minRaw) / (maxRaw - minRaw);
    }
}
