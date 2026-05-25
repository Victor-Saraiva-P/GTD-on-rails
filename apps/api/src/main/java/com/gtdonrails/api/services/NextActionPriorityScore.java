package com.gtdonrails.api.services;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import com.gtdonrails.api.entities.NextAction;

public class NextActionPriorityScore {

    private final LocalDate today;
    private final Integer currentTimeMinutes;
    private final BigDecimal currentEnergy;

    public NextActionPriorityScore(LocalDate today, Integer currentTimeMinutes, BigDecimal currentEnergy) {
        this.today = today;
        this.currentTimeMinutes = currentTimeMinutes;
        this.currentEnergy = currentEnergy;
    }

    /**
     * Calculates a selection score for priority ordering.
     *
     * <p>Example: {@code score.calculate(nextAction)}.</p>
     */
    public double calculate(NextAction nextAction) {
        return 2.2 * urgency(nextAction.getDeadline()) + 1.2 * viability(nextAction);
    }

    private double urgency(LocalDate deadline) {
        if (deadline == null) return 0.0;
        long days = ChronoUnit.DAYS.between(today, deadline);
        if (days <= 0) return 1.0;
        if (days <= 2) return 0.9;
        if (days <= 5) return 0.7;
        if (days <= 10) return 0.45;
        if (days <= 21) return 0.2;
        return 0.0;
    }

    private double viability(NextAction nextAction) {
        return 0.55 * timeFit(nextAction.getEstimatedTime()) + 0.45 * energyFit(nextAction.getEnergy());
    }

    private double timeFit(Duration estimatedTime) {
        int estimate = Math.toIntExact(estimatedTime.toMinutes());
        if (currentTimeMinutes == null || estimate <= currentTimeMinutes) return 1.0;
        int denominator = Math.max(currentTimeMinutes, 15);
        return Math.max(0.0, 1.0 - ((double) estimate - currentTimeMinutes) / denominator);
    }

    private double energyFit(BigDecimal requiredEnergy) {
        if (currentEnergy == null || BigDecimal.ZERO.compareTo(currentEnergy) == 0) return 1.0;
        if (requiredEnergy.compareTo(currentEnergy) <= 0) return 1.0;
        double delta = requiredEnergy.subtract(currentEnergy).doubleValue();
        return Math.max(0.0, 1.0 - delta / 3.0);
    }
}
