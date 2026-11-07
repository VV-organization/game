import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { getRaceFormat, RACE_FORMATS, type RaceFormatId } from '../shared/race-formats';

export function RaceFormatPicker({
  value,
  onChange,
}: {
  value: RaceFormatId;
  onChange: (value: RaceFormatId) => void;
}) {
  const id = useId();
  const format = getRaceFormat(value);
  return (
    <div className="race-format-picker">
      <label htmlFor={id}>Формат заезда</label>
      <div className="format">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(getRaceFormat(event.target.value).id)}
          aria-describedby={`${id}-rules`}
        >
          {RACE_FORMATS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <ChevronDown size={17} aria-hidden="true" />
      </div>
      <p className="format-description" id={`${id}-rules`}>
        {format.description}
      </p>
    </div>
  );
}
