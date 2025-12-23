export default function ValidatedInput(props) {
    const relevantProps = { ...props };
    delete relevantProps.label;
    delete relevantProps.name;
    delete relevantProps.errors;
    delete relevantProps.register;
    delete relevantProps.hint;

    const error = props.errors[props.name];

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-ink-300">
                {props.label}
            </label>
            <input
                className={`w-full px-4 py-3 bg-ink-900 border rounded-lg text-ink-100 placeholder-ink-500 transition-colors duration-200 focus:outline-none focus:ring-1 ${
                    error
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                        : "border-ink-700 focus:border-accent-cyan focus:ring-accent-cyan"
                }`}
                {...relevantProps}
                {...props.register(props.name)}
            />
            {props.hint && !error && (
                <p className="text-xs text-ink-500">{props.hint}</p>
            )}
            {error && <p className="text-sm text-red-400">{error.message}</p>}
        </div>
    );
}
