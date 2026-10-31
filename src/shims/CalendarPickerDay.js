import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import PropTypes from "prop-types";

import { differenceInDays } from "date-fns/differenceInDays";
import { isAfter } from "date-fns/isAfter";
import { isBefore } from "date-fns/isBefore";
import { isSameDay } from "date-fns/isSameDay";
import { isWithinInterval } from "date-fns/isWithinInterval";
import { startOfDay } from "date-fns/startOfDay";

function Marker({ color }) {
  if (!color) return null;
  return (
    <View pointerEvents="none" style={styles.dotWrap}>
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

export default function Day(props) {
  const {
    day,
    month,
    year,
    styles: calendarStyles,
    customDatesStyles = [],
    onPressDay,
    selectedStartDate,
    selectedEndDate,
    allowRangeSelection,
    allowBackwardRangeSelect,
    selectedDayStyle: propSelectedDayStyle,
    selectedDisabledDatesTextStyle,
    selectedRangeStartStyle,
    selectedRangeStyle,
    selectedRangeEndStyle,
    textStyle,
    todayTextStyle,
    selectedDayTextStyle: propSelectedDayTextStyle,
    selectedRangeStartTextStyle,
    selectedRangeEndTextStyle,
    minDate,
    maxDate,
    disabledDates,
    disabledDatesTextStyle,
    minRangeDuration,
    maxRangeDuration,
    enableDateChange,
  } = props;

  const thisDay = new Date(year, month, day, 12);
  const today = new Date();

  let dateOutOfRange;
  let computedSelectedDayStyle = calendarStyles.dayButton;
  let selectedDayTextStyle = {};
  let selectedDayStyle;
  let overrideOutOfRangeTextStyle;
  let dateIsBeforeMin = false;
  let dateIsAfterMax = false;
  let dateIsDisabled = false;
  let dateRangeLessThanMin = false;
  let dateRangeGreaterThanMax = false;

  if (maxDate) {
    dateIsAfterMax = isAfter(startOfDay(thisDay), startOfDay(maxDate));
  }
  if (minDate) {
    dateIsBeforeMin = isBefore(startOfDay(thisDay), startOfDay(minDate));
  }

  if (disabledDates) {
    if (Array.isArray(disabledDates) && disabledDates.indexOf(thisDay.valueOf()) >= 0) {
      dateIsDisabled = true;
    } else if (disabledDates instanceof Function) {
      dateIsDisabled = disabledDates(thisDay);
    }
  }

  if (allowRangeSelection && selectedStartDate && !selectedEndDate) {
    let daysDiff = differenceInDays(thisDay, selectedStartDate);
    daysDiff = allowBackwardRangeSelect ? Math.abs(daysDiff) : daysDiff;

    if (maxRangeDuration) {
      if (Array.isArray(maxRangeDuration)) {
        const maxRangeEntry = maxRangeDuration.find((mrd) => isSameDay(selectedStartDate, mrd.date));
        if (maxRangeEntry && daysDiff > maxRangeEntry.maxDuration) {
          dateRangeGreaterThanMax = true;
        }
      } else if (daysDiff > maxRangeDuration) {
        dateRangeGreaterThanMax = true;
      }
    }

    if (minRangeDuration) {
      if (Array.isArray(minRangeDuration)) {
        const minRangeEntry = minRangeDuration.find((mrd) => isSameDay(selectedStartDate, mrd.date));
        if (minRangeEntry && daysDiff < minRangeEntry.minDuration) {
          dateRangeLessThanMin = true;
        }
      } else if (daysDiff < minRangeDuration) {
        dateRangeLessThanMin = true;
      }
    }

    if (!allowBackwardRangeSelect && daysDiff < 0) {
      dateRangeLessThanMin = true;
    }
  }

  dateOutOfRange =
    dateIsAfterMax || dateIsBeforeMin || dateIsDisabled || dateRangeLessThanMin || dateRangeGreaterThanMax;

  const isThisDaySameAsSelectedStart = isSameDay(thisDay, selectedStartDate);
  const isThisDaySameAsSelectedEnd = isSameDay(thisDay, selectedEndDate);
  const isThisDateInSelectedRange =
    selectedStartDate &&
    selectedEndDate &&
    isWithinInterval(thisDay, {
      start: selectedStartDate,
      end: selectedEndDate,
    });

  if (!dateOutOfRange || isThisDaySameAsSelectedStart || isThisDaySameAsSelectedEnd || isThisDateInSelectedRange) {
    const isToday = isSameDay(thisDay, today);
    if (isToday) {
      computedSelectedDayStyle = calendarStyles.selectedToday;
      selectedDayTextStyle = [todayTextStyle || calendarStyles.selectedDayLabel, propSelectedDayTextStyle];
    }

    const custom = getCustomDateStyle({ customDatesStyles, date: thisDay });

    if (isToday && custom.style) {
      computedSelectedDayStyle = [calendarStyles.selectedToday, custom.style];
    }

    if (!allowRangeSelection && selectedStartDate && isThisDaySameAsSelectedStart) {
      computedSelectedDayStyle = calendarStyles.selectedDay;
      selectedDayTextStyle = [
        calendarStyles.selectedDayLabel,
        isToday && todayTextStyle,
        propSelectedDayTextStyle,
      ];
      selectedDayStyle = propSelectedDayStyle || calendarStyles.selectedDayBackground;
    }

    if (allowRangeSelection) {
      if (selectedStartDate && selectedEndDate) {
        if (isThisDaySameAsSelectedStart) {
          computedSelectedDayStyle = [calendarStyles.startDayWrapper, selectedRangeStyle, selectedRangeStartStyle];
          selectedDayTextStyle = [
            calendarStyles.selectedDayLabel,
            propSelectedDayTextStyle,
            selectedRangeStartTextStyle,
          ];
        }
        if (isThisDaySameAsSelectedEnd) {
          computedSelectedDayStyle = [calendarStyles.endDayWrapper, selectedRangeStyle, selectedRangeEndStyle];
          selectedDayTextStyle = [
            calendarStyles.selectedDayLabel,
            propSelectedDayTextStyle,
            selectedRangeEndTextStyle,
          ];
        }
        if (
          isThisDaySameAsSelectedEnd &&
          isThisDaySameAsSelectedStart &&
          isSameDay(selectedEndDate, selectedStartDate)
        ) {
          computedSelectedDayStyle = [
            calendarStyles.selectedDay,
            calendarStyles.selectedDayBackground,
            selectedRangeStyle,
          ];
          selectedDayTextStyle = [
            calendarStyles.selectedDayLabel,
            propSelectedDayTextStyle,
            selectedRangeStartTextStyle,
          ];
        }
        if (
          !isThisDaySameAsSelectedEnd &&
          !isThisDaySameAsSelectedStart &&
          isWithinInterval(thisDay, { start: selectedStartDate, end: selectedEndDate })
        ) {
          computedSelectedDayStyle = [calendarStyles.inRangeDay, selectedRangeStyle];
          selectedDayTextStyle = [calendarStyles.selectedDayLabel, propSelectedDayTextStyle];
        }
      }
      if (selectedStartDate && !selectedEndDate && isThisDaySameAsSelectedStart) {
        computedSelectedDayStyle = [calendarStyles.startDayWrapper, selectedRangeStyle, selectedRangeStartStyle];
        selectedDayTextStyle = [
          calendarStyles.selectedDayLabel,
          propSelectedDayTextStyle,
          selectedRangeStartTextStyle,
        ];
        overrideOutOfRangeTextStyle = selectedRangeStartTextStyle;
      }
    }

    const hideDot = isToday || isThisDaySameAsSelectedStart;
    const dotColor = hideDot ? undefined : custom.dotColor;

    if (dateOutOfRange) {
      return (
        <View style={calendarStyles.dayWrapper}>
          <Marker color={dotColor} />
          <View style={[computedSelectedDayStyle, selectedDayStyle]}>
            <Text
              style={[
                calendarStyles.dayLabel,
                textStyle,
                calendarStyles.disabledText,
                disabledDatesTextStyle,
                calendarStyles.selectedDisabledText,
                selectedDisabledDatesTextStyle,
                overrideOutOfRangeTextStyle,
              ]}
            >
              {day}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={calendarStyles.dayWrapper}>
        <Marker color={dotColor} />
        <TouchableOpacity
          disabled={!enableDateChange}
          style={[computedSelectedDayStyle, selectedDayStyle]}
          onPress={() => onPressDay({ year, month, day })}
        >
          <Text style={[calendarStyles.dayLabel, textStyle, selectedDayTextStyle]}>{day}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const custom = getCustomDateStyle({ customDatesStyles, date: thisDay });
  return (
    <View style={calendarStyles.dayWrapper}>
      <Marker color={custom.allowDisabled ? custom.dotColor : undefined} />
      <View style={calendarStyles.dayButton}>
        <Text style={[textStyle, calendarStyles.disabledText, disabledDatesTextStyle]}>{day}</Text>
      </View>
    </View>
  );
}

function getCustomDateStyle({ customDatesStyles, date }) {
  if (Array.isArray(customDatesStyles)) {
    for (const cds of customDatesStyles) {
      if (isSameDay(date, new Date(cds.date))) {
        return { ...cds };
      }
    }
  } else if (customDatesStyles instanceof Function) {
    return { ...(customDatesStyles(date) || {}) };
  }
  return {};
}

Day.propTypes = {
  styles: PropTypes.shape({}),
  day: PropTypes.number,
  onPressDay: PropTypes.func,
  disabledDates: PropTypes.oneOfType([PropTypes.array, PropTypes.func]),
  minRangeDuration: PropTypes.oneOfType([PropTypes.array, PropTypes.number]),
  maxRangeDuration: PropTypes.oneOfType([PropTypes.array, PropTypes.number]),
};

const styles = StyleSheet.create({
  dotWrap: {
    position: "absolute",
    top: 1,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
