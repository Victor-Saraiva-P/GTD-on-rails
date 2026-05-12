package com.gtdonrails.api.entities;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import com.gtdonrails.api.persistence.converters.DurationMinutesConverter;
import com.gtdonrails.api.types.ScheduleWindow;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;

@Entity
@Table(name = "next_actions")
@Getter
public class NextAction extends AuditableEntity {

    public static final int ENERGY_SCALE = 1;
    public static final String MIN_ENERGY_VALUE = "0.0";
    public static final String MAX_ENERGY_VALUE = "10.0";
    public static final BigDecimal MIN_ENERGY = new BigDecimal(MIN_ENERGY_VALUE);
    public static final BigDecimal MAX_ENERGY = new BigDecimal(MAX_ENERGY_VALUE);
    public static final String MIN_TIME_VALUE = "PT0M";

    @Id
    @Column(name = "item_id", nullable = false, updatable = false)
    private UUID itemId;

    @OneToOne(optional = false)
    @MapsId
    @JoinColumn(name = "item_id", nullable = false)
    private Item item;

    @Column(nullable = false, precision = 10, scale = ENERGY_SCALE)
    private BigDecimal energy;

    @Convert(converter = DurationMinutesConverter.class)
    @Column(name = "estimated_time_minutes", nullable = false)
    private Duration estimatedTime;

    @Embedded
    private final ScheduleWindow schedule = ScheduleWindow.unscheduled();

    @ManyToMany
    @JoinTable(
        name = "next_action_contexts",
        joinColumns = @JoinColumn(name = "next_action_id"),
        inverseJoinColumns = @JoinColumn(name = "context_id")
    )
    private final Set<Context> contexts = new HashSet<>();

    public NextAction() {
    }

    public NextAction(Item item, BigDecimal energy, Duration estimatedTime, Set<Context> contexts) {
        setItem(item);
        setEnergy(energy);
        setEstimatedTime(estimatedTime);
        replaceContexts(contexts);
    }

    /**
     * Connects this next action to the item it clarifies.
     *
     * <p>Example: {@code nextAction.setItem(item)}.</p>
     */
    public void setItem(Item item) {
        if (item == null) {
            throw new IllegalArgumentException("item value 'null' is invalid; expected Item");
        }

        this.item = item;
        if (item.getNextAction() != this) {
            item.setNextAction(this);
        }
    }

    /**
     * Stores required energy after normalizing scale and validating range.
     *
     * <p>Example: {@code nextAction.setEnergy(new BigDecimal("4.5"))}.</p>
     */
    public void setEnergy(BigDecimal energy) {
        if (energy == null) {
            throw new IllegalArgumentException("energy value 'null' is invalid; expected BigDecimal");
        }

        BigDecimal normalizedEnergy = energy.stripTrailingZeros();
        requireAllowedEnergyScale(normalizedEnergy);
        normalizedEnergy = energy.setScale(ENERGY_SCALE);
        requireEnergyInRange(normalizedEnergy);
        this.energy = normalizedEnergy;
    }

    /**
     * Stores required time estimates when they use whole-minute precision.
     *
     * <p>Example: {@code nextAction.setEstimatedTime(Duration.ofMinutes(90))}.</p>
     */
    public void setEstimatedTime(Duration estimatedTime) {
        if (estimatedTime == null) {
            throw new IllegalArgumentException("time value 'null' is invalid; expected Duration");
        }
        if (estimatedTime.isNegative()) {
            throw new IllegalArgumentException(
                "time value '" + estimatedTime + "' is invalid; expected greater than or equal to " + MIN_TIME_VALUE);
        }
        if (estimatedTime.getSeconds() % 60 != 0 || estimatedTime.getNano() != 0) {
            throw new IllegalArgumentException(
                "time value '" + estimatedTime + "' is invalid; expected whole-minute Duration");
        }

        this.estimatedTime = estimatedTime;
    }

    /**
     * Opens this next action's schedule window at the current clock time.
     *
     * <p>Example: {@code nextAction.registerScheduleStart(clock)}.</p>
     */
    public void registerScheduleStart(Clock clock) {
        schedule.registerStart(clock);
    }

    /**
     * Closes this next action's schedule window at the current clock time.
     *
     * <p>Example: {@code nextAction.registerScheduleEnd(clock)}.</p>
     */
    public void registerScheduleEnd(Clock clock) {
        schedule.registerEnd(clock);
    }

    /**
     * Adds one required execution context and keeps both relation sides aligned.
     *
     * <p>Example: {@code nextAction.addContext(context)}.</p>
     */
    public void addContext(Context context) {
        if (context == null) {
            throw new IllegalArgumentException("context value 'null' is invalid; expected Context");
        }

        contexts.add(context);
        context.getNextActions().add(this);
    }

    /**
     * Removes a context while keeping both relation sides aligned.
     *
     * <p>Example: {@code nextAction.removeContext(context)}.</p>
     */
    public void removeContext(Context context) {
        if (context == null) {
            return;
        }

        contexts.remove(context);
        context.getNextActions().remove(this);
    }

    /**
     * Replaces contexts while requiring at least one next-action context.
     *
     * <p>Example: {@code nextAction.replaceContexts(Set.of(homeContext))}.</p>
     */
    public void replaceContexts(Set<Context> contexts) {
        if (contexts == null || contexts.isEmpty()) {
            throw new IllegalArgumentException("contexts value '" + contexts + "' is invalid; expected at least one Context");
        }

        Set<Context> currentContexts = new HashSet<>(this.contexts);
        currentContexts.forEach(this::removeContext);
        contexts.forEach(this::addContext);
    }

    @PrePersist
    void prePersist() {
        initializeAuditTimestamps();
    }

    @PreUpdate
    void preUpdate() {
        touchUpdatedAt();
    }

    private void requireAllowedEnergyScale(BigDecimal energy) {
        if (energy.scale() > ENERGY_SCALE) {
            throw new IllegalArgumentException(
                "energy value '" + energy + "' is invalid; expected up to " + ENERGY_SCALE + " decimal place");
        }
    }

    private void requireEnergyInRange(BigDecimal energy) {
        if (energy.compareTo(MIN_ENERGY) < 0 || energy.compareTo(MAX_ENERGY) > 0) {
            throw new IllegalArgumentException(
                "energy value '" + energy + "' is invalid; expected between " + MIN_ENERGY_VALUE + " and " + MAX_ENERGY_VALUE);
        }
    }
}
