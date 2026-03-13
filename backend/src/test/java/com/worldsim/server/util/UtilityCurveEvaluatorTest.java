package com.worldsim.server.util;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class UtilityCurveEvaluatorTest {

    @Test
    void testInverseLinearNeed() {
        // High need score when value is low
        assertEquals(1.0, UtilityCurveEvaluator.evaluateInverseLinearNeed(0.0));
        assertEquals(0.8, UtilityCurveEvaluator.evaluateInverseLinearNeed(20.0), 0.001);
        
        // Low need score when value is high
        assertEquals(0.0, UtilityCurveEvaluator.evaluateInverseLinearNeed(100.0));
        
        // Out of bounds
        assertEquals(1.0, UtilityCurveEvaluator.evaluateInverseLinearNeed(-10.0));
        assertEquals(0.0, UtilityCurveEvaluator.evaluateInverseLinearNeed(110.0));
    }

    @Test
    void testInverseExponentialNeed() {
        double steepness = 5.0;
        
        // Spikes when near 0
        assertEquals(1.0, UtilityCurveEvaluator.evaluateInverseExponentialNeed(0.0, steepness), 0.001);
        
        // Flattens out quickly as it approaches 100
        double midScore = UtilityCurveEvaluator.evaluateInverseExponentialNeed(50.0, steepness);
        assertTrue(midScore < 0.2); // Exp(-2.5) is very low

        assertEquals(0.0, UtilityCurveEvaluator.evaluateInverseExponentialNeed(100.0, steepness), 0.001);
    }
}
